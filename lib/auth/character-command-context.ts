import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { VerifiedHitDieContext } from "@/lib/character/hit-die-authority";

// Finite first profile: a nonanonymous authenticated token, verified through
// the SDK and a same-token user lookup. This does not verify database session
// lifetime, hold Auth locks, enable SQL writers, or authorize a character save.
const unavailable = Object.freeze({ status: "unavailable", reason: "auth_unavailable" } as const);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const firstSecond = -62135596800; // 0001-01-01T00:00:00Z
const lastSecond = 253402300799; // 9999-12-31T23:59:59Z

function configuredIssuer(): string | null {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return null;
  const url = new URL(configured);
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]"
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || url.href !== `${url.origin}/`
    || !(url.protocol === "https:" || (url.protocol === "http:" && loopback))) return null;
  return `${url.origin}/auth/v1`;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function numericDate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value)
    && value >= firstSecond && value <= lastSecond;
}

function currentAt(issued: number, expires: number, notBefore: number | undefined): boolean {
  const now = Date.now();
  return Number.isSafeInteger(now) && now >= firstSecond * 1000 && now <= lastSecond * 1000 + 999
    && issued * 1000 <= now && (notBefore === undefined || notBefore * 1000 <= now)
    && expires * 1000 > now;
}

/** The selected fields come from one exact verified cookie token. Extra
 * verified claims are ignored; cookie/session user data and expiry are unused. */
export async function resolveCharacterCommandContext(): Promise<
  | { status: "token_verified"; context: Readonly<VerifiedHitDieContext> }
  | { status: "unavailable"; reason: "auth_unavailable" }
> {
  try {
    const issuer = configuredIssuer();
    if (!issuer) return unavailable;
    const client = await createClient();
    const session = await client.auth.getSession();
    if (session.error) return unavailable;
    const token = session.data?.session?.access_token;
    if (typeof token !== "string" || token.trim().length === 0 || token.length > 32768
      || new TextEncoder().encode(token).byteLength > 32768) return unavailable;

    const verified = await client.auth.getClaims(token);
    if (verified.error || !record(verified.data?.claims)) return unavailable;
    const claims = verified.data.claims;
    // Copy primitive selected values before the next asynchronous boundary.
    const actor = claims.sub, sessionId = claims.session_id;
    const expires = claims.exp, issued = claims.iat, notBefore = claims.nbf;
    const audience = claims.aud;
    if (typeof actor !== "string" || !uuid.test(actor)
      || typeof sessionId !== "string" || !uuid.test(sessionId)
      || claims.role !== "authenticated" || claims.is_anonymous !== false || claims.iss !== issuer
      || !(audience === "authenticated" || (Array.isArray(audience)
        && audience.length === 1 && audience[0] === "authenticated"))
      || !numericDate(expires) || !numericDate(issued)
      || (notBefore !== undefined && !numericDate(notBefore))) return unavailable;
    if (issued >= expires || (notBefore !== undefined && notBefore >= expires)
      || !currentAt(issued, expires, notBefore)) return unavailable;

    const lookup = await client.auth.getUser(token);
    const user = lookup.data?.user;
    if (lookup.error || !user || user.id !== actor || user.is_anonymous !== false
      || user.role !== "authenticated" || user.aud !== "authenticated"
      || !currentAt(issued, expires, notBefore)) return unavailable;

    const context: Readonly<VerifiedHitDieContext> = Object.freeze({
      context_version: 1,
      actor_id: actor,
      session_id: sessionId,
      jwt_expires_at: new Date(expires * 1000).toISOString().replace(".000Z", ".000000Z"),
    });
    return { status: "token_verified", context };
  } catch {
    return unavailable;
  }
}
