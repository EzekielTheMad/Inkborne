# Character command token verification — local checkpoint

Victor requested the next checkpoint toward authenticated character saving.
Vercel hosting remains unchanged; M1–M6 including M5.5 remain active, M7 and
creature imports remain paused, and M8 follows accepted core work.

## Source and review

Integration workspace:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`,
branch `codex/launch-integration-20261011`, base `113af68`.

- `0dc7a4b` (worker `e35b0b7`): new server-only token-context resolver.
- `f534bfb`: 68 controlled-boundary tests and seven installed-SDK tests.

The worker reused the existing isolated checkout. Its old branch/commit `f05e58e`
was preserved; the new `codex/character-command-context-20261022` branch starts
at integration base `113af68`. It is clean at its one-file source commit, with
no dependencies, tests or services started. Root owns the only verification lane.

Independent source review passed for worker SHA256
`f3da78cd005f3be1b8f2215b92f25cc140c8c244ac3dadd238dbeface150f4ea`.
Integration CRLF SHA256 is
`351003f9f589b8dbb44ba78700e0b81cd29b90cd45f39a79d91bf76cdb54e569`;
both checkouts have Git blob `e9aff0d5ee9e86668518bc341ba866a8be88f12c`.
The byte difference is line endings, not a source change.
Independent review of both test files and these checkpoint/status documents also
passed, including a separate normalized-byte/hash comparison.

## Delivered behavior

`lib/auth/character-command-context.ts` implements the server boundary specified
in the [accepted authority plan](../specs/2026-10-12-hit-die-authority-reader-plan.md).
`resolveCharacterCommandContext()` takes no caller-supplied identity, token,
clock or verifier. It uses the existing cookie client and reads `getSession()`
only to capture one untrusted access-token string. Session user, expiry, refresh
token and metadata do not supply identity or authority.

The exact captured token is passed explicitly to both installed SDK
`getClaims(token)` and `getUser(token)`. Claims must identify the returned user;
the selected UUIDs, issuer, audience, role and times are checked. Primitive
selected claims are captured before the user-lookup await, and the clock is
checked again afterward. Expiry equality refuses. Integer NumericDate expiry is
projected exactly into the existing four-field context with six UTC fractional
digits. No raw token/user/claims/error is returned, stored or logged by the helper.

Success is deliberately named `token_verified`, not save acceptance. The frozen
context contains only `context_version`, `actor_id`, `session_id` and
`jwt_expires_at`. Every failure returns the same `auth_unavailable` result.
No SDK verification options, alternate keys or caller-injected verification
callbacks are exposed. The gameplay context import is type-only.

This first finite profile additionally requires nonanonymous identity, lowercase
RFC UUIDs (no nil/max), authenticated role and a single authenticated audience,
supported year1–9999 integer iat/exp/optional nbf, no future iat/nbf and strict
iat/nbf-before-exp ordering. These are explicit profile restrictions, not a claim
that Supabase anonymous users are unauthenticated. Unused standard/custom verified
claims are allowed and ignored. The configured issuer must be the root project
HTTP(S) origin plus `/auth/v1`; HTTP is restricted to loopback. Custom issuer
paths/audiences and other profiles fail closed pending separate support.

## Verification

Evidence root:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence`.

`local-character-context-20261022T140642Z`: **75/75 passed**, two files, one worker;
all five observed process identities exited. Controlled cases cover exact token
correspondence across waits/cookie changes, ignored cookie identity/expiry,
metadata exclusion, finite configuration/claims/provider identities, absent or
oversized tokens, expired/equal deadlines, expiry during lookup, malformed/error
responses and the maximum supported expiry. These are controlled SDK-response
tests, not a live Auth-provider claim.

The seven SDK cases use the unchanged installed Supabase JS2.110.7 implementation,
ephemeral in-memory keys and strict in-process GET-only JWKS/user fetch routes.
Both the explicit SDK transport and global fetch are trapped; there is no network
fallback. Real ES256 verification accepts the matching key and rejects a tampered
payload and a different matching-kid key before user lookup. Auth denial, null and
different-user responses refuse. HS256 exercises the SDK's same-token Auth-server
fallback twice; its modeled server response is provider-contract evidence, not
local HMAC-signature or live-provider verification. No raw JWT is kept in request
records; bearer correspondence is recorded as a boolean. Cookie transport remains
modeled even in these seven cases. RS256, live cookie refresh, target signing/JWKS
configuration and the actual provider are not exercised.

Full `npm.cmd run check` at executable source `f534bfb`:
`local-check-20261022T140655Z`, **PASS** typecheck, zero-warning lint,
**365 files / 5057 passed / three UNVERIFIED M5 skips**, four bounded workers.
Finished 14:11:08.7818641 UTC; all 432 observed process identities exited.
The three skips remain open requirements, not accepted/waived behavior.
Only documentation changed afterward.

Independent final readback at14:11:35.8770151 UTC found all five focused and432
full-check recorded identities absent. No task-owned service was started.
Before/final system aggregates were523/520 processes,7,075,032/7,531,640KiB free
memory,20/21percent CPU and44/44 TCP listeners. These include shared machine
activity; no per-process attribution or continuous resource measurement is claimed.
The recorded before observation and independent readback sit beside the full
gate's summary/process journal.

No browser workflow or route changed, so no E2E server or build was started.
No native SQL, provider flow, credentials, hosted data, push, merge, deployment
or Vercel configuration changed.

## Remaining boundary

The resolver is unused by application routes. It neither constructs a service
client nor invokes an RPC. Original SQL Auth functions, readiness gates and all
admission refusals are unchanged. Token verification and user lookup are separate
provider transactions; they hold no native session/user/profile/owner locks and
cannot establish the command's acceptance point or defeat later revocation.

G2 baseline/catalog proved neither session schema/configuration nor maximum-life,
inactivity, provider/RI-role, logout or lock-order semantics. Its original-user
preflight checked only id/raw_app_meta_data/raw_user_meta_data/email columns and
empty users alongside official migration history. Do not infer native Auth
acceptance from that baseline or from these local tests.

Next, prepare and review the finite native Auth/session/configuration profile and
lock/expiry/revocation acceptance before changing either always-denied SQL seam.
Verified B1 planning must derive a new typed plan under that real Auth/owner and
source/writer closure, without adopting stored unverified calculations. Genuine
bootstrap issuance, B2 materializers, B3 guarded choices writing, receipt recovery,
browser persistence and hosted release acceptance remain open.

Official references refreshed for this source child:
[claims](https://supabase.com/docs/reference/javascript/auth-getclaims),
[user lookup](https://supabase.com/docs/reference/javascript/auth-getuser),
[sessions](https://supabase.com/docs/guides/auth/sessions) and
[server clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
The changelog and relevant TLS/PG notices were read; no dependency/platform change
was needed. Installed Next.js TypeScript, data-security and Vitest guides were read.
