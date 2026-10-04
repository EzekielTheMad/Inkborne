# Inkborne current work

Latest application cleanup: [conditional rolled death saves](handoffs/2026-10-04-conditional-death-saves-local.md). All rolled outcomes now gate before RNG and use the existing raw conditional API; tracked separate roll insertion blocks duplicate responsive rolls and preserves global uncertainty after natural-20 HP hides the control. Independent notes and retained recovery are covered. Types/lint, 217 files / 2,147 tests, build (24 pages) and 30 isolated Chrome checks passed; independent review found no remaining blockers. Roll/state saves remain separate, with no durable receipt or new hosted acceptance. Equipment staging remains paused. **Not release-ready.**

Previous application cleanup: [conditional concentration result and writer audit](handoffs/2026-10-04-conditional-concentration-result-local.md). Failed rolled concentration drops now use the existing raw conditional API; the actual prompt gates before RNG, awaits recovery, refuses repeat rolls after uncertain results and isolates newer check generations. Types/lint, 217 files / 2,128 tests, build (24 pages) and 22 isolated Chrome checks passed. Roll insertion/state save remain separate; no new hosted acceptance. Equipment staging remains paused. **Not release-ready.**

Previous local-only validation checkpoint: [starting-equipment boundary and approval-review blocker](handoffs/2026-10-04-starting-equipment-local-boundary.md). Strict standalone input/plan contracts are tested but unused. SQL/application staging and one parent-requested retry with original user quotes were rejected by automatic approval review for lack of direct trusted authorization for this exact scope; no transaction, migration, eligibility or caller integration was implemented. Types/lint and 217 files / 2,122 tests passed. That checkpoint changed no application caller; see the later concentration cleanup above. PostgreSQL equipment atomicity/idempotency/permissions remain unproven. **Not release-ready.**

Latest checkpoint: [complete replacement state-controls acceptance](handoffs/2026-10-04-replacement-state-controls-acceptance.md). One approved replacement/one creation attempt completed 32 desktop/mobile positive cases, 32 hidden conflict/committed-loss cases, two-owner and denial/rejection checks. All Back cases remounted; retained Activity remains local evidence. A proven mobile concentration/tools overlap is fixed. Types/lint, 216 files / 2,105 tests, build and 36 isolated Chrome checks passed. Exact-ID cleanup and ten-zero-count readback passed; port 3015 closed, all ten fixtures cleaned, zero attempts remain. No schema/security/publication change. **Not release-ready.**


Previous checkpoint: [closed ninth state-controls partial acceptance](handoffs/2026-10-04-ninth-state-controls-acceptance.md). One new private fixture was created and exact-ID cleaned; all nine child scopes verified absent, port 3015 closed, zero attempts remain. Desktop conditions, exhaustion and inspiration passed actual conditional saves/readback/reload. Remaining desktop/mobile/conflict/response-loss/Next lifecycle matrix is unaccepted. Hosted continuation was blocked by automatic approval review; cleanup-only approval succeeded. Local runner checks passed 216 files / 2,105 tests, types/lint and 35 isolated Chrome checks. Application remains `920d517`; no production/schema/security/publication change. **Not release-ready.**

Prior permission proposal: [one bounded hosted regression and separate equipment transaction design](specs/2026-10-03-next-permission-package.md); [local design evidence](handoffs/2026-10-03-next-permission-package.md). Proposal only; no execution authorized by these documents.

Previous application checkpoint: [local conditional manual state controls](handoffs/2026-10-03-conditional-manual-state-controls-local.md). Conditions, exhaustion, inspiration, activation toggles, manual death-save pips, effects, manual concentration and currency now explicitly use settled gates and raw-state conditional saves. Independent notes and failed currency/effect drafts remain reviewable; typed recovery survives retained Activity. Types, lint, 215 files / 2,104 tests, production build and 40 isolated Chrome checks passed, including 18 new responsive manual-control checks. No hosted calls, fixtures, schema changes or publication. All eight prior fixtures remain cleaned with zero attempts. Active manual state-only paths are converted locally; rolled outcomes, equipment transactions and old/direct writers remain separate boundaries. **Not release-ready.**

Local edits and validation remain authorized. The verbatim replacement approval was accepted after the working claim was confirmed; selected hosted acceptance is complete and the replacement allowance is exhausted and cleaned. The ninth rejection/partial results remain historical. The prior conditional short-rest checkpoint is retained as historical local evidence; use the latest handoff for current counts and the remaining-writer table.

Updated October 4, 2026. Branch: `codex/playable-core-stability`.
Historical application baseline before conditional HP integration: `71681c77c6bff1d5f6f2d9e1a2d1f0ec107c4b4d`. **Not release-ready.**

Start with the [release-readiness checklist](RELEASE-READINESS.md) and
[current closed-run handoff](handoffs/2026-10-04-replacement-state-controls-acceptance.md).
October 2 source validation is retained in the [compatibility handoff](handoffs/2026-10-02-builder-compatibility-review.md).
Other October 2 handoffs are historical checkpoints, not current counts or release claims.

## Direction and authority

Victor prioritizes the character builder and the fresh-character-to-play-sheet journey.
Preserve mechanics, narrative, campaign and LegendKeeper integration; no worldbuilding expansion.
Victor approved bounded hosted acceptance on October 3 for project `etcaodglvcspcmwecyxq`: at most six new uniquely identified characters, two existing approved accounts, and their run-owned refs/grants/inventory/spells/rolls. Existing rules and data must remain intact. Trello ownership was confirmed by the parent. Local edits/tests/commits remain authorized. No installs, new accounts, extra campaign/content fixtures, schema/migrations, credential/security configuration changes, other-worktree changes, push, merge or deploy. Cleanup must use exact recorded IDs and stop if action-time approval blocks deletion. Durable schema work remains a separate approval.

Checkout: `C:/Users/kaios/Documents/Codex/2026-10-02/task/inkborne-core`.
Supplied original baseline: `0a4acb93ab5fcda94d8efa13a87568c3315da108`.
The preceding consolidation review compared the full branch to local main `26e1f514693190e4afb2dc708ac97fb04a0f5814`,
which is its merge base/ancestor. No main-only commits; no remote fetch or main verification.

## October 3 acceptance checkpoint

The dedicated bounded runner is implemented and locally checked: types/lint and 210 files / 2,019 tests.
One real login/create/builder-refresh/nonowner-unchanged check passed. The same-fixture continuation
stopped at hosted 57014 statement timeouts after race/class and the first skill choice. Later read-only
probes passed, so the cause remains unproven. One character, four refs and 23 generated feature grants
were tracked and cleaned by exact ID; parent and all nine child-table scopes verified absent. Port 3015
is closed. No application code/schema/dependency change or publication occurred. Full journey/recovery/
concurrency acceptance remains pending; see the current handoff before any further hosted mutations.

## Prior October 2 local application result

- Relative HP/hit-die/rest gates preserve the failed-damage recovery and independent absolute
  edits. Retained Activity cast/rest sessions reconcile hidden completion/error once.
- Builder saves show pending/errors; ability and note drafts support explicit recovery. Failed
  notes remain accessible before background replacement, including the scoped Chrome header fix.
- Existing unique saved definitions are honored; conflicting core pins and invalid explicit
  choices cannot masquerade as valid. Selected styles/subclasses do not silently reselect newer data.
- Effect-editor drafts remain until persistence confirms, reusing the existing
  action hook. Overview/navigation say **Saved**, not full completion, and orphaned core pins show
  **In progress**. Supported per-level/ASI/style/trait/category checks now participate in saved readiness.
- Existing immutable class grants support explicit missing-feature restoration with failed-save retry.
  Fresh race selection writes parent pins only; unpinned trait choices remain usable with explicit current-
  catalog disclosure. Recorded trait pins stay authoritative; strict builder reads reject unreadable/mismatched snapshots.
- Strict types, zero-warning lint, **204 files / 2,001 tests**, production build (24 static pages),
  **23 builder + 6 play/effect Chrome checks** passed. These browser fixtures use actual components,
  Activity and production CSS with simulated persistence/router; no errors or remote attempts.

## Remaining work and approval boundaries

The fresh-race false block and authored any-language compatibility gap are fixed and independently
reviewed. Saved validates recorded evidence; unpinned traits remain outside full historical validation.
Other unknown categories need original-source research first; lost original core/race trait pins
and conflicting/orphaned provenance require evidence and a recovery policy, not catalog guessing.
Catalog fallback does not reconstruct original versions. Saved covers recorded evidence. Legacy rolled-only HP
grandfathering remains a product decision. No new critical local data-loss regression remained known;
this is not a whole-character or real-backend acceptance verdict.

The approved project is ACTIVE_HEALTHY. Effective RPC definitions/grants and RLS metadata were inspected read-only; seven relevant function bodies match local migrations. Main_PC and the original checkout configuration were verified without exposing values. Both existing accounts authenticate as distinct users; the isolated checkout simply lacks ignored configuration. The dedicated runner loads only the seven required settings internally. Real creation/builder refresh/nonowner no-match denial passed on one journaled fixture. Further acceptance and exact-ID cleanup are tracked in the current handoff.

Required real Next/auth/backend acceptance and the state RPC's no-match/ambiguous-outcome risks are in
the checklist. Equipment grants, concurrent choices/pins and ambiguous committed responses still
need durable guarantees. The [equipment proposal](specs/2026-10-02-equipment-atomicity-proposal.md)
and [action proposal](specs/2026-10-02-durable-character-actions-proposal.md) contain exact proposed
schema/hosted-test scope; neither is implemented. Do not infer safe replay from injected rejection.
