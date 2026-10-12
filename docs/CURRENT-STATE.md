# Inkborne current work

## Active execution — 2026-10-12 UTC

The human executed the project kickoff. Sole integration worktree remains
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`, now
on local branch `codex/launch-integration-20261011`. Product source through `02c7b53`
includes reviewed private magic-item/item/weapon/armor/core-race/trait/passive-feature/monster authoring, raw metadata and
effects preservation, print/PDF export, canonical weapon calculations, validated
single-source slots, exact selected subclass sources and per-acquisition casting math, explicit race-score
representation, read-only monster schema/stat blocks/Library, default-disabled
pure hit-die modeling, advisory advanced-spell binding models, patched dependencies and runtime fixture preparation.
Clean `2e20658` passed typecheck, zero-warning lint, **274 files / 3,023 tests**
with four test workers, then a synthetic production build. Setup/fixture failures
and one earlier five-second timeout are preserved and classified in the ledger.
Six provider/dialog casting cases, 80 race parity checks and 20 monster geometry
checks passed with explicit simulated-data/persistence boundaries. The mobile
Library implicit grid overflow was reproduced and fixed; later harness/fix source
has been integrated and awaits fresh combined check/build acceptance.
See the single [launch ledger](LAUNCH-ACCEPTANCE.md) for
exact source, reviews and open evidence. Original checkouts remain preserved.

Victor selected all included milestones before beta, PDF importing before beta,
and beta deferrals for Daggerheart/public publishing while retaining both in the
total project backlog. P1-P3 dispositions and the first supported PDF input matrix
remain explicit decisions. The durable-gameplay contract uses one trusted server
roll and immutable lifetime receipt; actual command/writer/database/recovery
integration remains unimplemented and disabled.

Subclass implementation and its stale-result/shared-math corrections passed
independent source review and are integrated as `a6d7efb` / `a41e186`. Private
monster authoring and its 127-test transport correction are integrated through
`6029274`; trait authoring and independently reviewed version/effect correction
are integrated through `bc6a4b2` after 128 narrow tests. Both families' Homebrew
integration seam passed independent review. Clean combined `bc6a4b2` passed
**295 files / 3,369 tests**, typecheck and zero-warning lint with four workers;
its nine subclass provider/cast/rest/print offline browser cases also passed.
Later clean `821eb1a` passed **297 files / 3,461 tests**, typecheck, zero-warning
lint and a synthetic production build. Actual monster and trait forms each
passed **28 desktop/mobile checks** with that exact build's CSS/fonts and hashed
source. Actions, navigation and persistence remain simulated. Six character
print cases at `9943f51` generated 33 A4/Letter pages; text, margins, privacy and
rendered layout checks passed. All owned processes/listeners closed. Trait CREATE uncertainty retains the draft and
requires checking Homebrew before an explicitly acknowledged further create.
Private passive-feature source `6f43b57` and test-only corrections through
`ff3e452` passed independent review and **145 focused tests**, typecheck and lint
in its isolated worker, then integrated through `02c7b53`. Exact Homebrew seam
review passed. Clean root `02c7b53` passed **302 files / 3,591 tests**, typecheck
and zero-warning lint; recorded process/listener readback is empty. Fresh build
and actual passive-feature form acceptance are next.
The staged hit-die kernel is undergoing source review and model/static checks;
its dependency reader is deliberately unavailable and production stays disabled.
Saved ASI consumer-parity plan `6fcd21e` passed independent challenge; its isolated
worker is implementing the bounded actual-consumer repair.
Development audit remains eight
unpatched high findings / zero critical, production zero; no residual risk is
accepted. Saved ASI parity remains a separate documented gap. The
[concrete runtime dry run](specs/2026-10-12-equipment-runtime-plan.md)
is reviewable. G1 engine startup/image pulls were requested; no approval or runtime
execution is inferred. G2 full SQL/fixture/ephemeral credential execution and G3-G5
hosted/auth/publication/ops actions remain separately gated. No live or remote write
has occurred in this continuation. A fresh read-only Docker request still finds
the Linux-engine pipe unavailable; no startup or image pull was attempted.

**Project-wide continuation:** use [CODEX-ORCHESTRATOR.md](CODEX-ORCHESTRATOR.md) and the single [LAUNCH-ACCEPTANCE.md](LAUNCH-ACCEPTANCE.md) ledger. The bounded local queue is complete, not the project. Historical tested core `ada6c9b` and standalone M1 evidence remain indexed below. The magic-item slice is now reviewed/integrated locally; later local product changes require combined candidate acceptance. Continue ready documented milestone work while actual access/approval lanes are blocked.

## October 11 local continuation

The isolated branch includes [executable starting-equipment coverage](handoffs/2026-10-11-equipment-postgres-wasm.md): 45 synthetic PostgreSQL-WASM cases, application boundaries and offline component acceptance. A copy-function alias collision was fixed by renaming only the new ledger row variable. Full migration-chain/concurrent-connection acceptance remains outstanding; October 4's no-SQL-runtime statement is historical. PR101's ability implementation is now reviewed/integrated locally; its existing already-applied migration reference was copied unchanged, not reapplied. No hosted changes or deployment occurred. Equipment rollout remains default-off.

## October 4 checkpoint (historical)

Latest equipment implementation: [atomic starting-equipment local staging](handoffs/2026-10-04-equipment-atomic-local-staging.md), committed as `c1d622c5de71c54515f52208f88137cc9f5b7b73`. Staged SQL and application integration are present; the earlier mediated-approval rejection is historical and superseded by the direct-session implementation. No PostgreSQL or hosted execution has occurred.

Start with the [consolidated project handoff](handoffs/2026-10-04-consolidated-project-handoff.md) and [release checklist](RELEASE-READINESS.md). Updated October 4, 2026. **Not release-ready.**

Branch: `codex/playable-core-stability`. Exact application checkpoint: `c1d622c5de71c54515f52208f88137cc9f5b7b73`; the closing documentation-only commit is reported separately. Checkout: `C:/Users/kaios/Documents/Codex/2026-10-02/task/inkborne-core`. Other worktrees remain untouched.

## Direction and current scope

Victor prioritizes the character builder and fresh-character-to-play-sheet journey. Preserve mechanics, narrative, campaigns and LegendKeeper; no worldbuilding expansion. Local source work, safe local tests/builds/review and logical commits were authorized. This bounded cleanup pass is closed; do not invent more features or interpret it as deployment approval.

Victor directly approved local-only equipment SQL staging and application integration; that scope is implemented. Runtime setup approval is pending. This reconciliation authorizes documentation only: no services/containers, SQL execution, install, configuration change, hosted fixture/write/test, credential/security change, remote push/merge/publication/deployment. All ten prior hosted fixtures remain exact-ID cleaned with zero attempts left. Historical proposals/approval quotes do not authorize new runtime or hosted work.

## Current completed result

- Builder: supported exact-pin/choice/readiness validation, shared Saved labels, visible conflicts/unreadable references, pending/errors and draft recovery; explicit existing class-manifest restoration. Unpinned traits disclose current-catalog use; Saved is limited validation.
- Sheet: relative HP gating, retained Activity recovery, conditional state-dependent actions and readable conflict/uncertainty. Rolled concentration/death-save gating occurs before RNG; death-save insertion is separately tracked and prevents duplicate responsive rolls. Independent notes preserved; mobile tools reachable.
- Equipment: unique lifecycle ledger, receipt/provenance and locked creation/award/copy SQL staged outside migrations; one authenticated server confirmation replaces sequential grants. Default-off gate is `INKBORNE_ATOMIC_STARTING_EQUIPMENT=true`. Receipt recovery precedes gate/catalog checks; ambiguous legacy no-marker awards fail closed. Schema/API declarations are hand-maintained, not generated from a database.
- Latest equipment handoff **reports** types/zero-warning lint, **220 files / 2,185 tests**, build/24 static pages and v3 local review passing. Reconciliation independently confirmed committed artifacts, clean checkout and the browser receipt: **24 simulated real-component checks**, zero page errors/remote requests, `liveSupabase:false`. It did not rerun tests/build/review. Prior death-save validation was 217 files / 2,147 tests and 30 state-control Chrome checks; those are historical receipts, not the equipment count.
- Hosted replacement: selected manual-state matrix **32 positive + 32 hidden recovery cases**, plus setup/ownership/denials. All Back cases remounted; full builder progression, current rolled changes and retained Activity remain unaccepted remotely. The final accepted receipts supersede listed historical failures within that matrix.

## Next boundaries

Highest risks: unproved PostgreSQL equipment transaction/locking/permissions/rollback/copy behavior and legacy partial-grant policy; separate roll/state outcomes and legacy-writer/ABA coordination; current end-to-end hosted acceptance; content/HP decisions; release operations. Local staging is complete, not durable acceptance.

Read-only discovery confirmed Docker Desktop 4.84.0 / CLI 29.6.2 installed but its Linux-engine pipe unavailable; no psql or Supabase CLI found. Proposed disposable local verification needs runtime/setup authorization and an official CLI/bootstrap path for the complete 82-migration Supabase baseline. No services were started. The [staged README](../supabase/staged/README.md) defines the database matrix and receipt-preserving rollback.

## Evidence index

- [Current equipment implementation and reported validation](handoffs/2026-10-04-equipment-atomic-local-staging.md)
- [Staged SQL prerequisites and rollback](../supabase/staged/README.md)
- [Current death-save local checkpoint](handoffs/2026-10-04-conditional-death-saves-local.md)
- [Previous concentration local checkpoint](handoffs/2026-10-04-conditional-concentration-result-local.md)
- [Completed and cleaned hosted replacement](handoffs/2026-10-04-replacement-state-controls-acceptance.md)
- [Historical equipment boundary and review denials](handoffs/2026-10-04-starting-equipment-local-boundary.md)
- [Builder compatibility milestone](handoffs/2026-10-02-builder-compatibility-review.md)

Earlier handoffs are historical, with their own test counts, failures and approvals. The original [fast continuation](handoffs/2026-10-02-fast-continuation.md) P1/P2 findings were subsequently fixed; they are not current unresolved defects. Nonsecret run journals and cleanup receipts must be retained, never reset.
