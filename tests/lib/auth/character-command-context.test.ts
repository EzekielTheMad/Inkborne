// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), session: vi.fn(), claims: vi.fn(), user: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.create }));
import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";

const actor = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const otherActor = "33333333-3333-4333-8333-333333333333";
const now = Date.parse("2026-10-22T14:00:00Z");
const issued = now / 1000 - 60;
const expiry = now / 1000 + 600;
const token = "fixture-untrusted-cookie-token";
const unavailable = { status: "unavailable", reason: "auth_unavailable" };
const validClaims = () => ({
  iss: "https://character-auth-fixture.invalid/auth/v1", sub: actor,
  session_id: sessionId, aud: "authenticated", role: "authenticated",
  exp: expiry, iat: issued, is_anonymous: false,
});
const validUser = () => ({ id: actor, aud: "authenticated", role: "authenticated", is_anonymous: false });
const claimsResponse = (claims: unknown) => ({ data: { claims }, error: null });
const userResponse = (user: unknown) => ({ data: { user }, error: null });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://character-auth-fixture.invalid");
  vi.spyOn(Date, "now").mockReturnValue(now);
  mocks.create.mockResolvedValue({ auth: { getSession: mocks.session, getClaims: mocks.claims, getUser: mocks.user } });
  mocks.session.mockResolvedValue({ data: { session: { access_token: token } }, error: null });
  mocks.claims.mockResolvedValue(claimsResponse(validClaims()));
  mocks.user.mockResolvedValue(userResponse(validUser()));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("server character command token context", () => {
  it("binds the exact captured token to both verifiers and returns only the frozen context", async () => {
    const result = await resolveCharacterCommandContext();
    expect(result).toEqual({ status: "token_verified", context: {
      context_version: 1, actor_id: actor, session_id: sessionId,
      jwt_expires_at: "2026-10-22T14:10:00.000000Z",
    } });
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.claims).toHaveBeenCalledExactlyOnceWith(token);
    expect(mocks.user).toHaveBeenCalledExactlyOnceWith(token);
    if (result.status === "token_verified") expect(Object.isFrozen(result.context)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("ignores unverified cookie identity and expiry fields", async () => {
    const cookie = { access_token: token };
    for (const key of ["user", "expires_at", "expires_in", "refresh_token"]) {
      Object.defineProperty(cookie, key, { get() { throw new Error("untrusted cookie field read"); } });
    }
    mocks.session.mockResolvedValue({ data: { session: cookie }, error: null });
    expect((await resolveCharacterCommandContext()).status).toBe("token_verified");
  });

  it("does not reread cookies when the session token changes during verification", async () => {
    const cookie = { access_token: token };
    mocks.session.mockResolvedValue({ data: { session: cookie }, error: null });
    mocks.claims.mockImplementation(async () => {
      cookie.access_token = "different-later-token";
      return claimsResponse(validClaims());
    });
    expect((await resolveCharacterCommandContext()).status).toBe("token_verified");
    expect(mocks.user).toHaveBeenCalledExactlyOnceWith(token);
    expect(mocks.session).toHaveBeenCalledTimes(1);
  });

  it("ignores metadata and unrelated verified claims without returning them", async () => {
    mocks.claims.mockResolvedValue(claimsResponse({ ...validClaims(),
      aal: "aal1", amr: [{ method: "password", timestamp: issued }],
      user_metadata: { actor_id: otherActor, admin: true }, app_metadata: { private: "fixture-private" },
      custom_extension: { any: "unused" },
    }));
    mocks.user.mockResolvedValue(userResponse({ ...validUser(), email: "fixture@example.invalid", user_metadata: { actor_id: otherActor } }));
    const result = await resolveCharacterCommandContext();
    expect(result.status).toBe("token_verified");
    expect(JSON.stringify(result)).not.toMatch(/fixture-private|example|metadata|admin|unused/);
  });

  it.each(["", "not a URL", "ftp://fixture.invalid", "http://fixture.invalid", "https://user:pass@fixture.invalid", "https://fixture.invalid/path", "https://fixture.invalid?query=1", "https://fixture.invalid/#hash"])(
    "refuses unsupported configuration before constructing a client: %s", async url => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      expect(await resolveCharacterCommandContext()).toEqual(unavailable);
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it("allows root trailing slash without changing the issuer contract", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://character-auth-fixture.invalid/");
    expect((await resolveCharacterCommandContext()).status).toBe("token_verified");
  });

  it("allows explicit local development HTTP without weakening issuer equality", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    mocks.claims.mockResolvedValue(claimsResponse({ ...validClaims(), iss: "http://127.0.0.1:54321/auth/v1" }));
    expect((await resolveCharacterCommandContext()).status).toBe("token_verified");
  });

  it.each([null, {}, { access_token: "" }, { access_token: 42 }, { access_token: "a".repeat(32769) }])(
    "refuses absent or unsupported token transport %#", async session => {
      mocks.session.mockResolvedValue({ data: { session }, error: null });
      expect(await resolveCharacterCommandContext()).toEqual(unavailable);
      expect(mocks.claims).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["sub", otherActor], ["sub", "not-a-uuid"], ["sub", "00000000-0000-0000-0000-000000000000"],
    ["session_id", "bad"], ["session_id", null], ["session_id", "ffffffff-ffff-ffff-ffff-ffffffffffff"],
    ["iss", "https://another-project.invalid/auth/v1"], ["iss", "https://character-auth-fixture.invalid/auth/v1/"],
    ["aud", "anon"], ["aud", ["authenticated", "service_role"]], ["aud", []],
    ["role", "service_role"], ["role", "anon"], ["is_anonymous", true], ["is_anonymous", undefined],
    ["exp", String(expiry)], ["exp", expiry + 0.5], ["exp", Number.POSITIVE_INFINITY],
    ["exp", Number.NaN], ["exp", 253402300800], ["exp", now / 1000],
    ["iat", expiry], ["iat", now / 1000 + 1], ["iat", undefined], ["iat", issued + 0.5],
    ["nbf", now / 1000 + 1], ["nbf", "bad"], ["nbf", null], ["nbf", expiry],
  ])("refuses malformed, mismatched or unsupported security claim %s (%#)", async (key, value) => {
    mocks.claims.mockResolvedValue(claimsResponse({ ...validClaims(), [key as string]: value }));
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
  });

  it("accepts the finite singleton audience and a currently effective not-before", async () => {
    mocks.claims.mockResolvedValue(claimsResponse({ ...validClaims(), aud: ["authenticated"], nbf: now / 1000 }));
    expect((await resolveCharacterCommandContext()).status).toBe("token_verified");
  });

  it.each([
    null, { ...validUser(), id: otherActor }, { ...validUser(), is_anonymous: true },
    { ...validUser(), is_anonymous: undefined }, { ...validUser(), role: "service_role" },
    { ...validUser(), aud: "anon" },
  ])("refuses absent or mismatched provider identity %#", async user => {
    mocks.user.mockResolvedValue(userResponse(user));
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
  });

  it.each(["create", "session", "claims", "user"] as const)("sanitizes thrown failures at %s", async stage => {
    mocks[stage].mockRejectedValue(new Error(`fixture-sensitive-token: ${token}`));
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
  });

  it.each(["session", "claims", "user"] as const)("sanitizes SDK error payloads at %s", async stage => {
    mocks[stage].mockResolvedValue({ data: stage === "session" ? { session: { access_token: token } } : stage === "claims" ? { claims: validClaims() } : { user: validUser() }, error: { message: token } });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
  });

  it.each([null, { data: null, error: null }, { data: { claims: null }, error: null }])("refuses malformed verification responses %#", async response => {
    mocks.claims.mockResolvedValue(response);
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
  });

  it("refuses expiry reached during provider verification", async () => {
    mocks.user.mockImplementation(async () => {
      vi.spyOn(Date, "now").mockReturnValue(expiry * 1000);
      return userResponse(validUser());
    });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
  });

  it("refuses an invalid post-verification clock", async () => {
    mocks.user.mockImplementation(async () => {
      vi.spyOn(Date, "now").mockReturnValue(Number.NaN);
      return userResponse(validUser());
    });
    expect(await resolveCharacterCommandContext()).toEqual(unavailable);
  });

  it("projects the last supported whole-second expiry exactly", async () => {
    mocks.claims.mockResolvedValue(claimsResponse({ ...validClaims(), exp: 253402300799 }));
    const result = await resolveCharacterCommandContext();
    expect(result.status).toBe("token_verified");
    if (result.status === "token_verified") expect(result.context.jwt_expires_at).toBe("9999-12-31T23:59:59.000000Z");
  });
});
