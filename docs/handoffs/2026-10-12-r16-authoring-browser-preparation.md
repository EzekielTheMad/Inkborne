# R16.2 actual MonsterForm offline harness — source preparation only

Prepared after guarded-response source `7765abf` and correction receipt `31f4f3d`.
No browser/server, esbuild fixture compilation, production build, full check,
install, database/runtime request, provider action or SQL ran for this harness.
Only static `node --check`, TypeScript/TSX syntax parsing (not typecheck) and
`git diff --check` ran. Independent harness/source review and root's current
combined build + serialized UI release are required before execution. Earlier
foundation/browser and correction-unit receipts do not verify this new harness.

## Files and finite acceptance plan

New files only: `scripts/verify-monster-authoring-local.mjs`,
`scripts/monster-authoring-scenarios.mjs`,
`e2e/local-monster-authoring/{fixture.tsx,playwright.config.ts,authoring.spec.ts}`.
The existing `verify-monsters-local.mjs`, `local-monsters` config/spec and all
foundation evidence stay unchanged. Invocation only after reviewed release:

```text
npm.cmd run test:e2e -- --config e2e/local-monster-authoring/playwright.config.ts
```

One worker, no retries, 240-second test limit. Exactly **28 recorded checks**:
14 each at **1280x900 desktop** and **390x844 mobile**.

| Check per viewport | Actual behavior versus explicit simulation |
| --- | --- |
| 1 | Actual blank create controls have no guessed AC/HP/scores/speed/size; invalid submit focuses Name and invokes no synthetic action. Actual root fonts load. |
| 2 | Fill structured create controls; keyboard Add/Move/Remove on duplicate named traits retains meaningful order and declared walk zero. Controls reachable/no body overflow. |
| 3 | Actual serialized controls/mapper create a **synthetic local record**, then remount actual edit controls from it. No database create or real Server Action HTTP proof. |
| 4 | Languages absent→present-empty→explicit absent across simulated save/readback; actual intent and synthetic historical v1 stay distinct. Not deployed immutable snapshot proof. |
| 5 | Real recoverable callback/native form reset retain creature type, duplicate order and changed-group intent; synthetic stored record unchanged. |
| 6 | Actual pending state disables controls/submit; an additional native `requestSubmit()` invokes no second action; release retains draft. |
| 7 | Synthetic concurrent revision returns conflict; real form locks retries and retains stale draft. Actual Reload latest uses local HTTP reload and synthetic session readback, never resubmits. |
| 8 | Actual rejected callback **after synthetic write** returns uncertainty/Check Homebrew; draft/native-reset protection remain, one invocation/no false confirmation. Does not infer rollback. |
| 9 | Actual malformed callback **after synthetic write** follows the same retained-draft/no-confirmation path. This is separate from rejection evidence. |
| 10 | Name control declares max length 100; a 101-character autofill-style control value is refused before action and retained/focused, without truncating it. |
| 11 | Original all-fields fixture round-trips through actual controls/mapper with declared zero/negative values and a synthetic no-op retaining exact record/version. |
| 12 | Actual stat-block preview displays literal synthetic script/HTML/handler/URL text escaped; no injected node, handler, URL execution or side effect. |
| 13 | Original >60 KiB/<=64 KiB multibyte/unbroken-text fixture mounts all 20 traits with actual fonts/no body overflow. |
| 14 | Last full structured textarea and preview tail are reachable after scroll, bounded horizontally and vertically with no clipping ancestor. |

Recorded screenshots per viewport: blank required/validation, rejected draft,
malformed draft, all-fields preview, near-budget top and final tail. Layout failure
records viewport/document width, offending nodes and bounded ancestor geometry
plus a failure screenshot. Assertion remains document width <= viewport+1;
fixtures/names/content are not truncated to hide a failure. Controls use real
labels, fieldsets and native keyboard button activation.

## Current root-build/actual-source receipt contract

Reuse the reviewed foundation manifest guard: exact current root HEAD, accepted
foundation `cda325ae527c6c86ad7e45d4a886c1c85de2800d` ancestry, exact sibling
`equipment-verification/.next/static`, hashed BUILD_ID and saved clean successful
`gate: build`/numeric exit 0/source SHA/status receipt, all compiled CSS and every
referenced local resource, actual generated font variable classes, loaded
FontFaces and requested hashed font files. No fallback/simplified CSS or fonts.

Root-produced manifest goes in executing-worktree
`test-results/monster-authoring-local/production-artifacts.json`, or direct runner
`--artifact-manifest <absolute path>`. Same base fields as the reviewed foundation
manifest plus **required**:

```text
dependencyLockSha256: <current root package-lock.json byte SHA-256>,
authoringSources: [
  {relativePath: "components/library/monster-form.tsx", sha256: <current root bytes>},
  {relativePath: "lib/homebrew/monster-action-response.ts", sha256: <current root bytes>},
  {relativePath: "lib/homebrew/monster-form.ts", sha256: <current root bytes>},
  {relativePath: "lib/homebrew/monster-draft.ts", sha256: <current root bytes>},
  {relativePath: "lib/schemas/content-types/monster.ts", sha256: <current root bytes>},
  {relativePath: "components/compendium/monster-stat-block.tsx", sha256: <current root bytes>},
  {relativePath: "e2e/local-monster-authoring/fixture.tsx", sha256: <current root bytes>}
]
```

Exactly these seven paths/hashes are required, and mounted/current-root files and
locks must match. Both root and mounting worktree must currently be clean. After
the offline bundle compiles, every actual project input and actual Next browser
helper/classifier input is hashed and compared with current root files before
server/browser startup. This rejects a stale worker copy or hidden transitive
product drift; root can execute its integrated harness in its own clean source.
Root supplies actual hashes/paths after review/integration/current build, never
relabeled predecessor assets. Source-only preparation has not read any build asset.

## Transport/navigation/auth/storage boundaries

Actual MonsterForm, canonical mapper/schema/draft merge and stat-block preview are
compiled from current reviewed sources. Only its own monster server-actions module
is replaced with labeled local callbacks. The required `next/navigation`
`unstable_rethrow` resolves to **actual installed Next browser implementation and
its actual navigation/error helpers**, with their byte hashes compared to root;
there is no invented digest, fake rethrow or success exception. Existing pure
correction tests cover genuine framework signals. This browser harness does not
claim to run a Next router, server redirect or authenticated route.

Native anchors replace Link as in the reviewed foundation harness; Check Homebrew
href is verified, not treated as a live Homebrew read. The fixture toolbar is an
explicit test surface. A run-owned, per-context synthetic session-store key allows
local reload/readback and synthetic history; it contains original fixtures only.
Normal callbacks return a validated idle response and fixture readback evidence,
not the product's confirmed-save server redirect. No Auth/JWT/role/RLS/persistence,
real Server Actions HTTP, concurrent PostgreSQL or immutable database acceptance.

Loopback server accepts **GET only**, serves only verified local assets/fixture
JS and `/authoring`, and logs unexpected paths/methods. Browser route blocks remote
requests and non-GET network writes. Final evidence requires zero page errors,
blocked/unexpected requests, actual loaded fonts, 28 checks and clean owned-port/
process shutdown. Synthetic action/storage writes are deliberately recorded apart
from prohibited network/runtime writes.

## Process/evidence ownership

The copied reviewed runtime records Node/worker/browser PID, parent, command,
cwd, start time and dynamic HTTP/browser control ports. Chrome is private, local
and headless. IPC stop closes browser before server; normal/failure paths persist
evidence and verify HTTP/control port refusal and browser exit. The Playwright
finally block permits force cleanup only after fresh exact child PID + parent +
command proof, preserving all unrelated workers/processes. No process is started
by this preparation. Harness output is distinct `test-results/monster-authoring-local`
and Playwright output `test-results/monster-authoring-offline-playwright`.
