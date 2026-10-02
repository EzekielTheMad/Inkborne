# Inkborne current work

Updated October 2, 2026, around 19:30 UTC. Branch: `codex/playable-core-stability`.
Verified source: `e209583b9cf208305305f33a62653de38c358d88`. **Not release-ready.**

Start with the [release-readiness checklist](RELEASE-READINESS.md) and
[latest validation/recovery handoff](handoffs/2026-10-02-builder-validation-recovery.md).
Other October 2 handoffs are historical checkpoints, not current counts or release claims.

## Direction and authority

Victor prioritizes the character builder and the fresh-character-to-play-sheet journey.
Preserve mechanics, narrative, campaign and LegendKeeper integration; no worldbuilding expansion.
Only local edits, safe tests/builds and commits are authorized. No installs, hosted Supabase
tests/writes, schema/migrations, credential/security changes, other-worktree changes, push,
merge or deploy. The parent reauthorized continuation at 18:25 UTC without a new deadline,
then requested consolidation and this bounded builder validation/recovery milestone. Product/architecture changes need the parent;
durable schema and hosted acceptance need Victor's explicit approval.

Checkout: `C:/Users/kaios/Documents/Codex/2026-10-02/task/inkborne-core`.
Supplied original baseline: `0a4acb93ab5fcda94d8efa13a87568c3315da108`.
The preceding consolidation review compared the full branch to local main `26e1f514693190e4afb2dc708ac97fb04a0f5814`,
which is its merge base/ancestor. No main-only commits; no remote fetch or main verification.

## Verified local result

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
  Missing race trait history is visible and blocks dependent choices; historical pins stay intact.
- Strict types, zero-warning lint, **204 files / 1,990 tests**, production build (24 static pages),
  **22 builder + 6 play/effect Chrome checks** passed. These browser fixtures use actual components,
  Activity and production CSS with simulated persistence/router; no errors or remote attempts.

## Remaining work and approval boundaries

Supported per-level/category validation and existing class-manifest recovery are complete for this
milestone. Unknown custom categories need authoritative vocabulary; lost original core/race trait pins
and conflicting/orphaned provenance require evidence and a recovery policy, not catalog guessing.
Existing selection display fallbacks do not repair pins or make readiness Saved. Legacy rolled-only HP
grandfathering remains a product decision. No new critical local data-loss regression remained known;
this is not a whole-character or real-backend acceptance verdict.

The next major blockers require approval for a named disposable staging target and tracked authenticated
acceptance/failure tests. The latest handoff contains a precise approval question. Durable schema changes
remain a separate approval; further general local cleanup cannot prove committed-response recovery.

Required real Next/auth/backend acceptance and the state RPC's no-match/search-path risks are in
the checklist. Equipment grants, concurrent choices/pins and ambiguous committed responses still
need durable guarantees. The [equipment proposal](specs/2026-10-02-equipment-atomicity-proposal.md)
and [action proposal](specs/2026-10-02-durable-character-actions-proposal.md) contain exact proposed
schema/hosted-test scope; neither is implemented. Do not infer safe replay from injected rejection.
