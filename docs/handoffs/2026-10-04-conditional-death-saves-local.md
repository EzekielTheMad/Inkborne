# Conditional rolled death saves: local checkpoint

October 4, 2026. Based on clean `c1b22b0c263eb5d133d263ff99cdde8ed270b9e1`. Authorized bounded local reliability cleanup only. **Not release-ready.**

## Result

Rolled death saves now use the existing settled action gate and raw conditional state API for every outcome. The gate checks confirmed HP/counts before RNG; existing natural-1, total-based success/failure and natural-20 rules remain unchanged. A generated roll is never implicitly replayed after a failed or ambiguous save. Independent absolute notes keep their existing queue behavior.

The actual roll popover accepts a caller-owned request override instead of generating a second default roll. Synchronous action guards and a shared provider insertion gate prevent duplicate rolls across responsive controls, including while character state has confirmed but the separate roll insert is still pending. A pre-RNG pending-state refusal remains explicitly retryable after pending edits settle.

Death saves opt into a strict insert response: the existing roll insert selects its returned ID and rejects SDK errors or missing confirmation. Ordinary roll callers retain their existing behavior. Roll recording and character state are still **two separate writes**, not an atomic durable receipt. Missing insert confirmation may represent a committed write with a lost response. Reload and review both state and roll log rather than generating another roll or reinserting it.

Retained Activity delivery keeps caller recovery after hide/settle/Back. Natural-20 success can hide the death-save control; separate global roll uncertainty remains visible there and survives a later failed note save. Reload waits for both character writes and tracked roll insertion to settle. No schema, security policy or hosted behavior was changed.

## Validation

Focused actual-provider/component/SDK regressions: **5 files / 82 tests passed**. They exercise actual UI requests and conditional action dependencies, established rules, refusal before RNG, independent notes, responsive duplicate gates, retained conflict/lost-response recovery, hidden natural-20 insertion uncertainty, pending insertion versus Reload, and unrelated note-error isolation.

- `npm run check`: TypeScript, zero-warning lint and **217 files / 2,147 tests** passed (57.37s test phase).
- `npm run build`: passed with dummy public configuration only; compiled in 8.6s, 24 static pages. No hosted environment was loaded.
- `node scripts/verify-state-controls-local.mjs`: **30 installed-Chrome checks passed**, including eight new rolled-death-save cases; zero page errors and zero remote requests. Harness-owned browser/server teardown completed.
- `git diff --check`: passed.

Evidence: `test-results/state-controls-local/evidence.json`. Final logs/receipt/handoff are copied into task-5 as `inkborne-death-save-final-check.txt`, `inkborne-death-save-final-build.txt`, `inkborne-death-save-chrome.txt`, `inkborne-death-save-evidence.json` and `inkborne-death-save-handoff.md`.

Independent critical review found two P2 recovery gaps (Reload during insertion, overwritten roll warning); both were fixed with regressions. Final review found no further blockers. The local Chrome harness uses the actual shell/provider/controls and installed browser with production CSS, deterministic RNG and simulated endpoint/router persistence. It proves neither PostgreSQL durability nor actual Next route retention. No hosted call, fixture or acceptance was performed.

## Consolidated remaining boundaries

- Starting-equipment sequential partial grants/duplicates and unverified legacy partial-grant policy remain the highest separate transaction risk. Denied SQL/application staging remains paused; the unused standalone contract adds no application guarantee. See [the approval boundary](2026-10-04-starting-equipment-local-boundary.md). No retry or alternative staging was attempted.
- Durable rolled-action reconciliation needs database-supported receipts and atomic coordination. This checkpoint does not implement those; concentration/hit-die and ordinary roll logging retain their separate-write limitations.
- Old/direct unconditional clients, cross-client ABA and changing derived inputs remain outside existing conditional protection. Independent notes can overwrite another client's same-field edit; first-arrival seen remains an unchanged low-impact idempotent absolute write.
- All ten prior hosted fixtures remain cleaned and their allowance exhausted. No new hosted verification, schema/migration, equipment integration, install, credential/security change, other-worktree change, push, merge, publication or deployment occurred.

Mechanics, character-builder direction, campaigns, narrative and LegendKeeper integration remain intact. This is the completed bounded local milestone, not an expansion of product scope or release approval.
