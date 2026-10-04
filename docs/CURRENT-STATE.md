# Inkborne current work

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
