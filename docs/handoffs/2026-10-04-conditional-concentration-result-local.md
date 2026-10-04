# Conditional concentration-result cleanup: local checkpoint

October 4, 2026. Based on clean `04b34087620e85c7168daa3db80c63af5e468803`. Local client cleanup only. **Not release-ready.**

## Result

The remaining `resolveConcentrationCheck("drop")` path used a render-derived effect snapshot with the legacy unconditional writer. A failed rolled CON save could therefore replace another client's newer concentration/effects. It now uses the existing settled `runAction` gate, recomputes the linked drop from confirmed state and explicitly requires the existing owner conditional RPC with its raw baseline. No new API/schema/permission or equipment operation was added.

The actual concentration prompt awaits rolled resolution through the existing retained-Activity action helper. Its empty-patch settled gate runs **before RNG/logging**. Busy clicks generate no extra roll. A pre-RNG pending-state rejection is retryable after saves settle; once a roll was generated and its result save failed, the same check cannot be rerolled here. Typed conflict/uncertainty keeps reload guidance. Manual Keep/dismiss remains local table adjudication. Independent absolute notes retain their existing queue behavior.

Pending checks and displayed errors are associated with check identity. An older successful resolution cannot clear a newly requested check; older failed delivery cannot attach its prompt error or reroll lock to a newer check. A newer check does not bypass the provider's global reload-required gate. Commit-phase identity synchronization runs before retained-Activity completion delivery.

**Roll insertion and state save are still separate.** This is stale-write and caller-recovery hardening, not an atomic rolled action, authoritative roll reconciliation or durable receipt implementation. A save response can be ambiguous; reload and review the roll log/current character rather than automatically replaying a drop or generating another roll.

## Scope and blocked equipment work

The parent explicitly paused denied equipment SQL/application staging and authorized only unaffected local unconditional-writer cleanup. No retry of that denied action, migration text/execution, hosted call/fixture, permission/security/configuration change, install, other-worktree change, push, merge, publication or deployment occurred. The strict equipment contract from `d3c0d2b` remains unused, with staging still blocked as recorded in the [equipment boundary handoff](2026-10-04-starting-equipment-local-boundary.md). All ten prior hosted fixtures remain exhausted and cleaned.

Mechanics, builder, narrative, campaigns and LegendKeeper are preserved. CON-save request/modifiers, RNG rules and roll logging contract are unchanged; only action gating, conditional drop persistence and recovery changed.

## Remaining unconditional writers

Audited active source callers, not hosted metadata or external clients:

| Writer | Status / remaining risk |
| --- | --- |
| Failed rolled concentration result | Converted locally to raw conditional state; separately logged roll still lacks transaction/receipt |
| Rolled death saves | Ordinary rolled success/failure nested-map path remains unconditional; natural-20 HP patch selects conditional persistence but roll generation/logging remains separate and caller recovery needs its own bounded review |
| Hit dice | Existing settled gate/conditional HP patch; roll insert and spend still separate |
| QuickNotes / NotesTab | Deliberate independent absolute edits; same-field cross-client overwrite remains |
| First-arrival seen flag | Idempotent absolute legacy write; low impact, unchanged |
| Starting equipment | Sequential inventory/currency/confirmation path unchanged; denied durable transaction staging remains paused |
| Inventory / armor changes | Separate child-row writes; exclusive equip/grant atomicity unchanged |
| Legacy RPC / direct owner RLS clients | Unchanged and can bypass conditional protection |
| Server whole-state helper | Latent replacement helper; no active production state replacement caller found |
| Cast/slots/resources/rest/manual effects/concentration/currency/conditions/pips/inspiration | Existing explicit conditional callers retained; no new hosted acceptance of this checkpoint |

Pure helper comments referencing `patchState` describe patch shape and are not themselves unconditional database callers. The first-arrival and independent absolute note paths were deliberately not piecemeal converted because their queue/recovery contract differs from state-dependent gameplay actions. Equipment, legacy partial-grant policy and durable rolled receipts remain separate blocked/review boundaries.

## Local validation and evidence

- `npm run check`: TypeScript, zero-warning lint and **217 files / 2,128 tests** passed (53.29s test phase).
- `npm run build`: passed with dummy public configuration only; compiled in 5.9s, 24 static pages. No hosted environment was loaded.
- `node scripts/verify-state-controls-local.mjs`: **22 installed-Chrome checks passed**, including four new desktop/mobile rolled-concentration retained recovery cases; zero page errors, zero remote requests. Harness-owned browser/server teardown completed.
- Independent critical review found and fixed retry and check-error isolation P2s, then found no further blockers. React best-practices hook/Activity/accessibility review completed; no dependencies or rendering framework added. `git diff --check` passed.

New actual-provider regressions cover raw conditional drop, retained Activity hide/settle/reveal conflict and committed-response-loss simulation, queued notes, repeated clicks, pre-RNG rejection then explicit retry, older-error isolation, provider reload gating and older-completion/newer-check preservation. The fixture raises one damage event per mounted instance; Activity reactivation no longer fabricates a second damage event. RNG is deterministic in these tests; actual provider roll logging and conditional dispatcher execute against a local RPC model.

The existing installed-Chrome state-control script adds four desktop/mobile rolled-concentration conflict/lost-response cases using actual CharacterShell/provider/prompt/dialogs, production CSS and retained Activity/history Back. Separate roll insertion is recorded locally; no hosted roll exists. Two native clicks in one task verify the actual busy handler, and queued notes use the actual writer through fixture controls (not a claim of typing behind a modal). Explicit Reload reads the simulated canonical state and no request/roll is replayed. These are simulated endpoint/router results, not real Next route retention or PostgreSQL guarantees.

No release-readiness verdict, new equipment guarantee, cross-client ABA fencing or durable roll recovery is claimed.

Evidence: `test-results/state-controls-local/evidence.json`. Final command logs are preserved in task-5 as `inkborne-legacy-concentration-final-check.txt`, `inkborne-legacy-concentration-final-build.txt` and `inkborne-legacy-concentration-chrome.txt`; current receipt copy is `inkborne-legacy-concentration-evidence.json`. Earlier focused fixture runs were superseded by the final full checks. No further broadened test loop or hosted acceptance was performed.

Next local candidate is a separately reviewed rolled-death-save caller guard/recovery audit. This does not authorize equipment staging, schema changes, durable-action implementation or hosted work. Coordinated old/direct writers, cross-client ABA and derived-input changes remain outside this checkpoint.
