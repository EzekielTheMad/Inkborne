# Background replacement recovery milestone

October 2, 2026, approximately 18:40 UTC. Source checkpoint:
`bd74cda343f31e3480a82ab3bfe063918d419c1a`, branch `codex/playable-core-stability`.
Continued from clean `dfd00d4fa2172493a6cad9cc269016fd729a322f` after the parent
reauthorized work at 18:25 UTC without a new deadline. This is the requested coherent
verified milestone; no additional feature work was started. **Not release-ready.**

## Behavior

A failed custom background note previously could be retained outside its editor when
the user started replacing the background. Replacement now refuses to leave that editor
while any custom note is unconfirmed. The ordinary Change Background button remains
keyboard accessible and displays a readable instruction to leave the field or press Enter
to retry. The final replacement handler also checks drafts before sending a selection.
Existing pending-save and conflicting-pin gates remain in place.

The previously reverted attempt was not simply reapplied. A new local Chrome fixture
first reproduced the collapsed Change Background row even before adding a draft guard.
Flattening the header alone still failed. Removing inline-size containment from this
specific header produced a passing clean browser sequence. The header has no container
queries; other cards and their responsive behavior are unchanged. This is an observed
installed-Chrome fixture failure and scoped workaround, not proof of a general React or
Chrome defect. No runtime DOM mutation is used by the passing test.

After saving the note, the user can replace Courier with Scholar, whose preset Ideal is
different. The fixture models the existing canonical selection behavior: replacing a
background resets background narrative selections. Confirmed old notes are not promised
to carry over to a new background. That policy is unchanged; see the read-only inspected
local migration `supabase/migrations/20260722221534_atomic_background_selection.sql`.
There were no migration edits or hosted calls.

## Evidence and review

The component regression uses the real editor/action callbacks and asserts that failed
replacement preserves the draft, sends no replacement, and succeeds only after retry.
The browser fixture uses real components, React Activity, installed Chrome and production
CSS with simulated persistence/router. On a 390px viewport it saves on blur, hides the
step, rejects while hidden, goes Back, activates Change Background using keyboard Enter,
asserts the draft and instruction remain visible and no replacement was sent, retries the
exact note, then selects the different preset background. No test mutates layout to pass.

Manual source review checked both replacement entry points, existing save/pin guards,
draft-array identity clearing, and the reset policy against the local selection code.
No independent reviewer agent was used. Existing HP/action and retained-dialog browser
regressions also passed. Scope is one background component plus component/browser tests.

| Command | Result |
| --- | --- |
| `npm.cmd test` | 203 files / 1,969 tests passed |
| `npm.cmd run typecheck` | Passed on final source/tests |
| `npm.cmd run lint` | Passed, zero warnings |
| `npm.cmd test -- tests/components/builder/background-step-client.test.tsx` | 13 tests passed on final assertion |
| `npm.cmd run build` | Next 16.2.10 compile/types and 24 static pages passed |
| `node scripts/verify-builder-local.mjs` | 20 checks passed after fresh production build |
| `node scripts/verify-play-save-local.mjs` | 5 critical play checks passed |
| `git diff --check` | Passed |

Browser evidence reports no page errors or remote request attempts. Build public Supabase
values were loopback placeholders; no credentials or environment files were read.
Existing dependencies only, no installs. Initial typecheck caught an optional test-patch
field and was corrected; a browser navigation attempt needed the fixture's existing
confirmation acceptance before its intended hidden lifecycle. Final runs pass.

Ignored artifacts: `test-results/builder-local/evidence.json`,
`test-results/builder-local/background-replacement-recovery-mobile.png`, and
`test-results/play-save-local/`. Temp logs: `inkborne-note-full-tests.txt`,
`inkborne-note-types.txt`, `inkborne-note-lint.txt`, `inkborne-note-tests-final.txt`,
`inkborne-note-build.txt`, `inkborne-note-fresh-css-browser.txt`,
`inkborne-note-play-browser.txt`. Earlier failed/debug logs are diagnostic history.

## Remaining boundaries

These are simulated local checks, not live Next navigation/auth/RLS/Supabase acceptance.
Guaranteed rejected saves do not establish safe replay after a committed response is lost.
Draft protection is session-local; it does not provide cross-tab/reload durability.
Equipment inventory/currency/confirmation atomicity and cross-client ambiguous outcomes
still need the approved durable design work described in existing proposals. No schema,
hosted tests/writes, security/credential changes, installs, other-worktree changes, push,
merge or deployment occurred. Existing LegendKeeper/worldbuilding integration is intact.

Next bounded builder work: readiness for required per-level/ASI/category-backed choices
and missing/retired/orphan reference reconciliation, with evidence before widening scope.
Legacy rolled-only HP confirmation/grandfathering remains a product-policy question.
See [CURRENT-STATE](../CURRENT-STATE.md) and the historic [cutoff handoff](2026-10-02-cutoff-checkpoint.md).
