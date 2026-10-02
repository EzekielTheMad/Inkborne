# Equipment save controls (local mitigation, not atomic grants)

The existing equipment UI allowed confirmation while a selection write was pending. Failed selection saves only logged to console. A partially failed grant exposed raw backend messages and offered another confirmation in the same session, potentially repeating earlier inserts.

EquipmentStepClient now shares a synchronous local save gate between selections and confirmation. Options and confirmation stay disabled while a selection saves. Failed selections restore their prior visible selection, announce readable recovery and require an explicit successful selection retry before confirmation. Absolute choices still use the existing persistence path; no new transaction or source model is introduced.

A confirmation attempt locks further confirmation/selection mutation in that mounted session across either outcome. Success already renders the read-only confirmed state; failure explicitly explains that items/currency may have saved and asks the player to reload/review inventory. Raw server details are not rendered. The local lock cannot prove reload or multi-tab retry safety and is deliberately not a durable receipt. Navigation buttons wait during pending work, but history/unload and ambiguous completion still need the separately proposed durable model.

## Evidence

- Two new actual-control regressions failed before repair: pending selection could confirm, and partial grant failure exposed details/offered a repeat. The existing failure-copy assertion was updated to the new readable recovery contract.
- Targeted equipment chooser/page suites: 20 tests passed.
- `npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,920 tests passed after synchronous callback flags and fixture changes.
- `npm.cmd run build`: Next 16.2.10 compile, TypeScript and 24 static pages passed with loopback-only Supabase placeholders.
- Existing local Chrome fixture now has eight builder checks. The added equipment check uses real controls with deferred selection persistence, explicit retry and injected failure after one inventory grant. No hosted calls, page errors or remote requests; no software install. Together with the five play-save checks, 13 simulated browser cases pass.

Equipment grant atomicity, lost responses, reload reconciliation, different tabs, stale source choices and currency updates remain release risks. This mitigation does not implement the [durable atomic grant proposal](../specs/2026-10-02-equipment-atomicity-proposal.md). No schema/hosted changes accompany it.
