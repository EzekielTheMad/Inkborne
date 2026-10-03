# Inkborne current work

Latest checkpoint: [bounded play diagnostic and acceptance matrix](handoffs/2026-10-03-play-diagnostic.md). Fourth fixture creation/journey/mobile passed; approved play retry failed at HP trigger lookup before any intercepted gameplay request. No gameplay scenario or product defect was established. Fresh local production build, types/lint and 2,029 tests passed. **All four tracked fixtures exact-ID cleaned; two creation attempts remain.** Initial approval-review rejection was resolved with Victor's explicit transcript; the same call was retried once, then cleanup was approved and verified. **Not release-ready.**

Updated October 3, 2026. Branch: `codex/playable-core-stability`.
Prior verified application source: `71681c77c6bff1d5f6f2d9e1a2d1f0ec107c4b4d`. **Not release-ready.**

Start with the [release-readiness checklist](RELEASE-READINESS.md) and
[current bounded acceptance handoff](handoffs/2026-10-03-play-diagnostic.md).
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
