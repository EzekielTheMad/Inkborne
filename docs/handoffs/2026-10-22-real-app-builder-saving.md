# Real application builder saving

Executable checkpoint: `2e2b2529d7eca2be3a90838c22c9cfed4049a968` on
`codex/launch-integration-20261011` in
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`.

Race, abilities, background and starting equipment now save and reload in the
actual Next application against disposable local Supabase Auth, PostgREST and
PostgreSQL. This extends the [class-only delivery](2026-10-22-real-app-character-saving.md).
Vercel is unchanged; M1–M6/M5.5 remain active and M7/creature imports paused.

## User-visible result

One real browser signs in through the normal form, follows the dashboard link,
creates a named notebook and saves Fighter. It continues through the actual
builder controls to Human, six standard-array scores, Soldier with the
personality trait “I keep my word.”, and starting equipment. Every step is
checked after a full document reload. The equipment award retains Backpack,
Bedroll, Pouch and 10 gp. A fresh class read still displays Fighter at level 1.
An independently signed-in second account receives a 404 for that notebook.

The new path binds the existing screens to one locked database domain patch
per selection. Canonical saved values replace local drafts only after a matching
receipt; failed commands never fall back to whole-object table updates. The
abilities queue keeps its existing compare-and-swap behavior. Class links return
to the saved first-class view, and the next buttons follow race → abilities →
background → equipment after the initial class selection.

Equipment plans are compiled on the server from saved choices and exact pinned
sources. A separate service-only command checks current ownership/session and
applies inventory, currency, confirmation and a durable receipt atomically.
The browser cannot supply an award plan. The original award record is displayed
after reload; current inventory can subsequently differ during gameplay.

## Focused verification

| Evidence run | Observed result |
| --- | --- |
| `local-actual-app-20261022T222441Z` | One actual browser story passes: 27.6 seconds for the story, 29.7 seconds Playwright, 34.64 seconds including wrapper. No mocked actions, router, Auth response or saved character. Zero blocked remote origins and zero page errors. |
| `local-builder-ui-20261022T215920Z` | Seven relevant files / 140 tests pass across the four screens, ability persistence, equipment action and saved-class reader. |
| `local-builder-transport-20261022T220621Z` | Seven new action tests pass with Auth/RPC doubles: strict domain input, account matching, canonical receipts, same-operation resolution and mismatched receipt refusal. |
| `local-builder-transport-20261022T222515Z` | Final relevant subset: three files / 64 tests pass after hydration, diagnostic and navigation fixes. This repeats overlapping tests; it is not an additional 64 distinct cases. |
| `local-creation-browser-check-20261022T222515Z` | Typecheck and zero-warning lint pass on the final implementation. |

These use the existing `test`, `typecheck`, `lint` and `test:e2e` npm scripts.
The actual story supplies `--config e2e/local-app/playwright.config.ts` and a
restricted configuration via `INKBORNE_LOCAL_FLOW_CONFIG`; it refuses remote
origins and does not import hosted/default E2E setup. The full project suite was
intentionally not repeated under the user's focused-testing instruction.
Independent narrow source reviews passed for the SQL, transport and UI wiring.
The final ability and equipment screenshots were visually inspected.

Native selected-row readback confirms character
`47044f27-a957-4e7e-bf34-9451a40994ec`, owned row 1, Human, Soldier, the note,
base scores STR15/DEX14/CON13/INT12/WIS10/CHA8, four content pins and three
inventory rows of quantity 1 with award provenance. Currency is exactly 10 gp.
There is one awarded starting grant, confirmed equipment, one class receipt
and 11 builder receipts: race1, abilities6, background1, narrative1, selection1,
award1. Parent/order revisions are 12 and class-origin revision is 1. All five
physical row-order sets correspond; no transaction capability remains.

The retained Fighter occurrence matches the saved class choice. Its native
lifecycle is `provisional`, as produced by the existing first-class allocator;
advanced class acceptance is not claimed. The first readback assertion wrongly
required `accepted`. That failed assertion is preserved, and one selected-row
diagnostic corrected the correspondence assertion without changing data.

Live metadata confirms builder execution is authenticated-only and equipment
award execution service-only among API roles. Anonymous execution is denied,
service-role private-schema USAGE remains false, all 13 readiness rows are false,
and class/hit-die general gates are closed. This is ACL/readiness evidence plus
the representative owner/foreign-account browser story, not a concurrency or
complete adversarial authorization matrix.

## Failures corrected during real execution

- A generic lock primitive required a private guard UPDATE privilege unavailable
  to its caller. The new stage reuses the existing authority-owned guard routine
  through a narrowly owned helper; no private table privilege was broadened.
- The first ability edit could happen before hydration and save an empty draft.
  Controls now wait for client readiness. The final story immediately edits the
  freshly loaded page and verifies all six values after reload, without a delay.
- An equipment function qualified a local receipt variable as a table and failed
  with `42P01`. Renaming that variable fixes the receipt update. Native readback
  after failure found zero grants/items/currency: the transaction rolled back.
- The first test selected equipment by an accessible label with a nonexistent
  space. The locator now matches the actual label; product parsing was unchanged.
- Initial typecheck rejected a generated Zod discriminated-union tuple. The
  explicit finite command schema now typechecks; full ability slugs are retained.

Failed runs remain in the external evidence directory; successful assertions do
not overwrite their artifacts. The new staged source is
`supabase/staged/character-builder-steps.sql`, raw SHA256
`a1f8dc7df0aad75e7ae6854ba70a581b0a4d99bc9e594dea43ddf99e1aef75ad`.
The runtime installed its initial form and two identity/hash-checked narrow
repairs. The final combined stage contains both corrections; a fresh combined
replay was not repeated solely for this checkpoint. The original 17 stage files
and 83 baseline migrations were not edited. The legacy equipment stage was not
installed because it would introduce incompatible legacy grants/entrypoints.

## Evidence and cleanup

External evidence root is sibling `equipment-runtime/evidence`. The final
browser artifacts, including five screenshots and safe `actual-workflow.json`,
are under
`test-results/local-app/builder-2026-10-22T22-24-45-224Z/character-saving-sign-in-b-f7b2f-very-step-in-the-actual-app`.
Readback is `equipment-runtime/app-flow-runtime/final-builder-readback.json`;
the overstrict first assertion is `final-builder-readback-initial.json`.

The actual Playwright process exited 0. Its wrapper initially returned 1 because
it counted four Chrome-triggered system GoogleUpdater helpers as remaining task
processes. They were preserved and exited naturally. Final identity comparison
in `builder-final-process-readback.json` finds all 97 recorded identities across
the selected checks and Next launch absent; no updater was stopped.

Task-owned Next processes are stopped and port3001 is closed. The disposable
proxy, five containers, two networks, two volumes and three private credential
files are removed after readback. Ports9997/9998/9999 are closed. The runtime
teardown readback also finds all 299 recorded client identities absent. Final
`builder-resources-after-cleanup.json` records whole-host process count 670→630
and free memory 4,963,184→6,513,620 KiB against the final browser run's starting
snapshot; unrelated activity is included, so these are not task-only CPU or
memory measurements. No task listener remains. The shared Docker engine/cache
and inherited worker worktrees remain intact.

## Remaining acceptance

The runtime used two real local accounts and seven parser-valid synthetic content
definitions created through normal immutable-version triggers. No character or
receipt was inserted to simulate a successful save. This establishes the finite
Fighter/Human/Soldier/basic-equipment workflow, not full SRD catalog combinations.
Choices that introduce additional feature/spell grant graphs need their own
acceptance within the protected class graph. Advanced builder/gameplay, lost
response recovery across browser reloads, concurrency/provider UAT, fresh full
stage replay and hosted acceptance remain open. M1 is incomplete.

The creation UI flag was enabled only in the temporary Next environment against
loopback services. Repository defaults and general activation gates stay closed.
No push, deployment, hosted data/schema/security, Vercel setting or M7 work
occurred. Wider [writer fences](../specs/2026-10-22-enrolled-character-writer-fences.md)
remain a production activation requirement.
