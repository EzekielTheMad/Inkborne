# Inkborne current work

Updated October 2, 2026, around 18:55 UTC. Branch: `codex/playable-core-stability`.
Verified source: `d16f63fed30db28a1a9ddd43b9e4f5d1411331e7`. **Not release-ready.**

Start with the [release-readiness checklist](RELEASE-READINESS.md) and
[latest consolidation handoff](handoffs/2026-10-02-consolidation-acceptance.md).
Other October 2 handoffs are historical checkpoints, not current counts or release claims.

## Direction and authority

Victor prioritizes the character builder and the fresh-character-to-play-sheet journey.
Preserve mechanics, narrative, campaign and LegendKeeper integration; no worldbuilding expansion.
Only local edits, safe tests/builds and commits are authorized. No installs, hosted Supabase
tests/writes, schema/migrations, credential/security changes, other-worktree changes, push,
merge or deploy. The parent reauthorized continuation at 18:25 UTC without a new deadline,
then requested this bounded consolidation pass. Product/architecture changes need the parent;
durable schema and hosted acceptance need Victor's explicit approval.

Checkout: `C:/Users/kaios/Documents/Codex/2026-10-02/task/inkborne-core`.
Supplied original baseline: `0a4acb93ab5fcda94d8efa13a87568c3315da108`.
This review compared the full branch to local main `26e1f514693190e4afb2dc708ac97fb04a0f5814`,
which is its merge base/ancestor. No main-only commits; no remote fetch or main verification.

## Verified local result

- Relative HP/hit-die/rest gates preserve the failed-damage recovery and independent absolute
  edits. Retained Activity cast/rest sessions reconcile hidden completion/error once.
- Builder saves show pending/errors; ability and note drafts support explicit recovery. Failed
  notes remain accessible before background replacement, including the scoped Chrome header fix.
- Existing unique saved definitions are honored; conflicting core pins and invalid explicit
  choices cannot masquerade as valid. Selected styles/subclasses do not silently reselect newer data.
- This pass preserves failed effect-editor drafts until persistence confirms, reusing the existing
  action hook. Overview/navigation say **Saved**, not full completion, and orphaned core pins show
  **In progress**. Required per-level/category choices are still outside complete validation.
- Strict types, zero-warning lint, **203 files / 1,972 tests**, production build (24 static pages),
  **20 builder + 6 play/effect Chrome checks** passed. These browser fixtures use actual components,
  Activity and production CSS with simulated persistence/router; no errors or remote attempts.

## Remaining work and approval boundaries

Meaningful local-only work remains: complete per-level/ASI/category validation and supported
category choice UI, plus explicit recovery for missing/retired/orphaned reference data. No new
critical local data-loss regression remained known after this bounded pass; this is not proof
that all local behavior is complete. Legacy rolled-only HP grandfathering needs a product decision.

Required real Next/auth/backend acceptance and the state RPC's no-match/search-path risks are in
the checklist. Equipment grants, concurrent choices/pins and ambiguous committed responses still
need durable guarantees. The [equipment proposal](specs/2026-10-02-equipment-atomicity-proposal.md)
and [action proposal](specs/2026-10-02-durable-character-actions-proposal.md) contain exact proposed
schema/hosted-test scope; neither is implemented. Do not infer safe replay from injected rejection.
