# Inkborne current work

Updated October 2, 2026, around 19:44 UTC. Branch: `codex/playable-core-stability`.
Verified source: `d69be9d32c74ccfb676836a143105bbc86bf7e49`. **Not release-ready.**

Start with the [release-readiness checklist](RELEASE-READINESS.md) and
[latest validation/recovery handoff](handoffs/2026-10-02-builder-compatibility-review.md).
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

Victor is answering whether a disposable staging target exists or the configured project is live.
Hosted execution and credentials remain untouched pending that answer and the named acceptance scope. The latest handoff contains a precise approval question. Durable schema changes
remain a separate approval; further general local cleanup cannot prove committed-response recovery.

Required real Next/auth/backend acceptance and the state RPC's no-match/search-path risks are in
the checklist. Equipment grants, concurrent choices/pins and ambiguous committed responses still
need durable guarantees. The [equipment proposal](specs/2026-10-02-equipment-atomicity-proposal.md)
and [action proposal](specs/2026-10-02-durable-character-actions-proposal.md) contain exact proposed
schema/hosted-test scope; neither is implemented. Do not infer safe replay from injected rejection.
