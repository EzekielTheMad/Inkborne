// @vitest-environment node
import { createHmac, randomBytes, randomUUID, webcrypto } from "node:crypto";
import { createClient as createSupabaseClient, type Session, type User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";

// Real installed SDK verification with ephemeral keys and an in-process Auth
// transport. This proves neither live provider access nor database admission.
const project = "https://character-auth-fixture.invalid";
const actor = "10000000-0000-4000-8000-000000000001";
const otherActor = "10000000-0000-4000-8000-000000000002";
const sessionId = "10000000-0000-4000-8000-000000000003";
const unavailable = { status: "unavailable", reason: "auth_unavailable" };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
type RequestRecord = { url: string; method: string; bearerMatchesCapturedToken: boolean };
type FixtureOptions = { signature?: "tampered" | "wrong-key" | "hmac"; userBody?: unknown; userStatus?: number };

function providerUser(id = actor): User {
  return { id, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z", is_anonymous: false };
}

async function fixture(options: FixtureOptions = {}) {
  const now = Math.floor(Date.now() / 1000), expires = now + 3600;
  const claims = { iss: `${project}/auth/v1`, aud: "authenticated", sub: actor, role: "authenticated",
    session_id: sessionId, exp: expires, iat: now - 1, aal: "aal1", is_anonymous: false };
  const kid = randomUUID();
  const signingKeys = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publishedKeys = options.signature === "wrong-key"
    ? await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
    : signingKeys;
  const publicKey = { ...await webcrypto.subtle.exportKey("jwk", publishedKeys.publicKey), kid, alg: "ES256", use: "sig" };
  const header = encode({ alg: options.signature === "hmac" ? "HS256" : "ES256", typ: "JWT", kid });
  const payload = encode(claims), signingInput = `${header}.${payload}`;
  const signature = options.signature === "hmac"
    ? createHmac("sha256", randomBytes(32)).update(signingInput).digest("base64url")
    : Buffer.from(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKeys.privateKey,
      new TextEncoder().encode(signingInput))).toString("base64url");
  const capturedToken = options.signature === "tampered"
    ? `${header}.${encode({ ...claims, session_id: otherActor })}.${signature}`
    : `${signingInput}.${signature}`;
  const requests: RequestRecord[] = [];
  const strictFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    requests.push({ url, method, bearerMatchesCapturedToken: headers.get("authorization") === `Bearer ${capturedToken}` });
    if (method !== "GET") throw new Error("Fixture refuses non-GET Auth requests");
    if (url === `${project}/auth/v1/.well-known/jwks.json`) return Response.json({ keys: [publicKey] });
    if (url === `${project}/auth/v1/user`) {
      if (!requests[requests.length - 1].bearerMatchesCapturedToken) throw new Error("Fixture refuses another bearer identity");
      return Response.json(options.userBody === undefined ? providerUser() : options.userBody,
        { status: options.userStatus ?? 200 });
    }
    throw new Error("Fixture refuses an unexpected Auth route");
  };
  // Both paths are trapped: SDK's explicit transport and any accidental global
  // fetch. No request can reach the network, including an unexpected refresh.
  vi.stubGlobal("fetch", strictFetch);
  const client = createSupabaseClient(project, "inert-public-fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `sdk-fixture-${randomUUID()}` },
    global: { fetch: strictFetch },
  });
  // Only cookie transport is modeled. Claims/signature verification and user
  // response handling execute through the unmodified installed SDK.
  const getSession = vi.spyOn(client.auth, "getSession").mockResolvedValue({ data: { session: {
    access_token: capturedToken, token_type: "bearer", refresh_token: "inert-fixture-refresh",
    expires_in: 1, expires_at: 1, user: providerUser(otherActor),
  } satisfies Session }, error: null });
  vi.mocked(createCookieClient).mockResolvedValue(client as Awaited<ReturnType<typeof createCookieClient>>);
  return { requests, getSession, expires };
}

function assertRoutes(requests: RequestRecord[], expected: Array<"jwks" | "user">) {
  expect(requests.map(request => ({ route: request.url, method: request.method }))).toEqual(expected.map(route => ({
    route: `${project}/auth/v1/${route === "jwks" ? ".well-known/jwks.json" : "user"}`, method: "GET",
  })));
  expect(requests.filter(request => request.url.endsWith("/user")).every(request => request.bearerMatchesCapturedToken)).toBe(true);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", project);
  vi.stubGlobal("crypto", webcrypto);
  vi.mocked(createCookieClient).mockReset();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("character command context through the real installed Supabase SDK", () => {
  it("verifies ES256 and the exact bearer user, disregarding untrusted cookie user/expiry", async () => {
    const { requests, getSession, expires } = await fixture();
    expect(await resolveCharacterCommandContext()).toEqual({ status: "token_verified", context: {
      context_version: 1, actor_id: actor, session_id: sessionId,
      jwt_expires_at: new Date(expires * 1000).toISOString().replace(".000Z", ".000000Z"),
    } });
    expect(getSession).toHaveBeenCalledTimes(1);
    assertRoutes(requests, ["jwks", "user"]);
  });

  it("rejects a tampered ES256 payload before requesting a user", async () => {
    const { requests } = await fixture({ signature: "tampered" });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
    assertRoutes(requests, ["jwks"]);
  });

  it("rejects a matching-kid public key that did not sign the token", async () => {
    const { requests } = await fixture({ signature: "wrong-key" });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
    assertRoutes(requests, ["jwks"]);
  });

  it("rejects an Auth user endpoint denial after successful signature verification", async () => {
    const { requests } = await fixture({ userStatus: 401, userBody: { code: "bad_jwt", message: "Fixture denied the user request" } });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
    assertRoutes(requests, ["jwks", "user"]);
  });

  it("rejects a null user endpoint response without exposing SDK errors", async () => {
    const { requests } = await fixture({ userBody: null });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
    assertRoutes(requests, ["jwks", "user"]);
  });

  it("rejects a verified token whose Auth response identifies another user", async () => {
    const { requests } = await fixture({ userBody: providerUser(otherActor) });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
    assertRoutes(requests, ["jwks", "user"]);
  });

  it("uses the SDK's HS256 Auth fallback and repeats getUser with the same captured bearer", async () => {
    const { requests } = await fixture({ signature: "hmac" });
    const result = await resolveCharacterCommandContext();
    expect(result.status).toBe("token_verified");
    if (result.status === "token_verified") expect(result.context).toMatchObject({ actor_id: actor, session_id: sessionId });
    assertRoutes(requests, ["user", "user"]);
  });
});
