# Release-readiness checklist

> **Current project-wide execution (2026-10-12):** [CODEX-ORCHESTRATOR.md](CODEX-ORCHESTRATOR.md) is the entrypoint; [LAUNCH-ACCEPTANCE.md](LAUNCH-ACCEPTANCE.md) is the canonical milestone/requirement evidence ledger and completion gate. The October 11 local queue is a completed checkpoint, not project completion. Open rows/unknowns remain active; local source/SQL-file edits and offline work do not require invented approval. Actual runtime/live/security/publication operations retain their real boundaries.

October 11 [local queue is complete](handoffs/2026-10-11-orchestrator-local-queue.md). Exact tested core `ada6c9b`: TypeScript/lint, **2,292 tests**, build and **53 offline checks** pass after L1/A1/T1/D1 integration. Independent M1 source `3d61ff3`: **1,805 tests**, build and 12 checks pass. [D1](specs/2026-10-11-durable-roll-state-contract.md) and [E1 runtime](specs/2026-10-11-equipment-runtime-proposal.md) define remaining approval boundaries. Full database/hosted/provider/domain/backup acceptance and release authority remain open. **Not release-ready.** The October 4 checklist below is historical; it does not constrain the completed directly authorized local queue or imply runtime/hosted approval.

Equipment staging/integration is complete at [the local equipment checkpoint](handoffs/2026-10-04-equipment-atomic-local-staging.md). The old execution-review rejection is historical; PostgreSQL execution, hosted acceptance and rollout remain unapproved/unproved.

October 4, 2026. Current application `c1d622c5de71c54515f52208f88137cc9f5b7b73`; branch `codex/playable-core-stability`. **Not release-ready.** Use [CURRENT-STATE](CURRENT-STATE.md) for authority and the [consolidated project handoff](handoffs/2026-10-04-consolidated-project-handoff.md) for ranked risks, capabilities and evidence. This checklist supersedes earlier unapplied/partial-status bullets; historical results remain in their linked handoffs.

## Completed within scope

- [x] Supported builder exact-pin/choice/readiness validation, visible conflicts and save/draft recovery; Saved explicitly means limited recorded evidence.
- [x] Relative HP dependency regression and retained Activity cast/rest pending regression fixed; current full suite covers them.
- [x] Conditional state-dependent sheet actions, pre-RNG rolled concentration/death-save gates, no implicit uncertain-action replay, independent notes and mobile control access.
- [x] Equipment SQL text, authenticated single-action integration, default-off `INKBORNE_ATOMIC_STARTING_EQUIPMENT=true` gate, receipt-first recovery and latest-copy/provenance changes committed. No sequential equipment fallback; legacy no-marker cases remain unresolved. SQL is outside migrations; types are staged declarations.
- [x] Latest handoff reports types/zero-warning lint, **220 files / 2,185 tests**, build/24 pages and v3 local review passing. Documentation reconciliation independently inspected artifacts/clean checkout and **24 simulated Chrome receipt checks**, zero page errors/remote requests; it did not rerun validation. Earlier 2,147-test/30-state-control evidence remains historical.
- [x] Existing approved conditional endpoint/authenticated grants accepted previously; old RPC/RLS unchanged. Earlier unapplied proposal wording is historical, not current endpoint status.
- [x] [Hosted replacement](handoffs/2026-10-04-replacement-state-controls-acceptance.md): 32 desktop/mobile positive + 32 hidden recovery cases for selected manual-state callers, setup/ownership/denials; latest accepted receipts supersede its six historical failures. All Back lifecycles remounted; retained Activity remains local evidence.
- [x] All ten tracked hosted fixtures exact-ID cleaned and verified absent; zero attempts remain. Run-owned server/browser processes stopped; unrelated StreamDeck process untouched.

## Open release gates, in priority order

- [ ] Execute and verify equipment SQL in an explicitly authorized disposable local PostgreSQL/Supabase runtime: complete migration chain, syntax/privileges/RLS/triggers, every write-stage failure, concurrent equivalent/different intents, pin/ownership/copy races, consumption replay, committed-response loss and receipt-preserving rollback. Local source/mock/static tests do not prove these. Generate a real migration and regenerate schema types only within approved scope.
- [ ] Equipment hosted schema/security application, named bounded acceptance and rollout require separate authorization. Default gate remains off. Ambiguous legacy partial grants need policy; older/direct clients and stale replacement writers remain rollout limitations.
- [ ] Durable roll/state receipts, cross-client ambiguous-outcome handling, ABA/derived-input protection and coordinated old/direct writers. Separate insertion confirmation is not an atomic receipt. Requires separate durable-action/schema/hosted scope.
- [ ] Fresh current builder-to-sheet acceptance, choice/ref partial failures, latest rolled outcomes, actual retained lifecycle and broader auth/content/offline/device coverage. Requires new bounded hosted target/accounts/fixture/failure/cleanup approval; no residual allowance exists.
- [ ] Legacy Manual/Average HP under rolled-only rules, ambiguous legacy grants and irrecoverable original-pin policy; unknown vocabulary needs authoritative source research. No guessing or automatic regrant.
- [ ] Existing production UAT/security/privacy/dependency and publication/deployment gates. No release or rollout authority is implied.

## Next authorized step

Runtime setup approval is pending; this pass changes documentation only. Existing Docker Desktop/CLI is installed but the Linux engine is unavailable. Supabase CLI is missing; no runtime, image cache or PostgreSQL test has been exercised. The smallest next database step is an isolated local Supabase-compatible PostgreSQL 17 verification with a unique project/volume, loopback-only ports, full current migrations and exact resource cleanup; inspect official CLI capabilities before starting. No hosted link/configuration or old fixture allowance may be reused. See [staged prerequisites](../supabase/staged/README.md).

## Historical evidence

- [Builder compatibility](handoffs/2026-10-02-builder-compatibility-review.md): 23 builder + 6 play/effect local Chrome checks; simulated router/persistence.
- [Prior rolled death saves](handoffs/2026-10-04-conditional-death-saves-local.md): historical 2,147-test suite and 30 local Chrome checks, separate insert/state limitation.
- [Previous concentration cleanup](handoffs/2026-10-04-conditional-concentration-result-local.md): 2,128-test/22-check local checkpoint, superseded counts.
- [Hosted replacement](handoffs/2026-10-04-replacement-state-controls-acceptance.md): accepted manual-state matrix and cleanup, synthetic setup rather than full builder progression.
- [Equipment review boundary](handoffs/2026-10-04-starting-equipment-local-boundary.md): historical exact denials, superseded by the directly approved implementation.
- [Equipment local staging](handoffs/2026-10-04-equipment-atomic-local-staging.md): current reported validation, inspected artifacts/24-check browser receipt and explicit absence of PostgreSQL evidence.

Earlier hosted builder/HP/rest receipts are partial evidence for their historical source; early 57014 cause remains unproven. They do not accept this entire branch. Current local tests prove neither PostgreSQL guarantees nor hosted retained Activity. Preserve journals and both failed/accepted receipts rather than resetting history.
