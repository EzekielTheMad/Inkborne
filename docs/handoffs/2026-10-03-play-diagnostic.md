# Bounded play diagnostic and acceptance matrix - October 3, 2026

Application source remains 71681c77c6bff1d5f6f2d9e1a2d1f0ec107c4b4d. This checkpoint adds an independently reviewed diagnostic harness and records incomplete acceptance; no production or SQL change was made. Not release-ready.

## Evidence and current fixture

The new fourth fixture completed real hosted creation and the existing SRD journey/mobile checks: two tests passed in 28.1s, journey 18.1s. It exercised the same bounded Half-Orc/Barbarian/point-buy/Acolyte/equipment path as the preceding handoff. No expanded content or campaign fixtures were created.

The first play run timed out at 180 seconds without a completed scenario receipt. Its final snapshot was the sheet with HP 10/14; exact readback subsequently showed current_hp=10, temp_hp=0, hit_dice_spent={}. This establishes neither a gameplay regression nor a successful rejection/recovery test. A diagnostic continuation with 12-second action timeouts, 20-second navigation timeout and phase markers stopped before actions on EEXIST for the stale journal lock. Phase markers record entry, not success.

A process inspection confirmed no test Node worker remained (only an unrelated StreamDeck Node process). Automatic approval review then rejected the combined exact stale-lock removal and hosted continuation: the currently visible delegation forbids hosted writes/tests without further approval. That command did not execute. Approval was requested for the existing fixture's bounded continuation/cleanup; no further hosted action or cleanup ran in this checkpoint. Earlier documentation records parent-approved bounded acceptance, but documentation alone did not satisfy action-time approval. Preserve the lock until approval/reconciliation; never reset the journal or budget.

Run c9e2c9a0-0440-4d10-88b3-313bef708a28 has **four of six** creation attempts used and **two remaining**. The first three have durable cleaned receipts. **Live fixture: bf573168-adcc-4162-a4fb-5fdb823745cf**, owner e4b2972c-e54b-4940-ab27-75eb810f1dcf, name Inkborne bounded c9e2c9a0-0440-4d10-88b3-313bef708a28 4-builder. Latest completed child audit at 14:50:02.444 UTC recorded 5 refs, 23 feature grants, 10 inventory and no rolls. This predates the timed-out play attempt and is not a final cleanup receipt; audit again before exact-ID deletion. Do not delete by name prefix or touch earlier fixtures/preexisting records.

## Usable acceptance matrix

| Capability | Evidence | Verdict / limit |
| --- | --- | --- |
| P1 dependent relative HP recovery | Actual component/action local regression and simulated Chrome checks in prior checkpoints | Local accepted; real hosted play still unaccepted |
| P2 retained Activity cast/rest completion | Actual retained Activity local tests and simulated Chrome checks | Local accepted; real Next hide-settle-Back still unaccepted |
| Fresh SRD builder -> sheet | Real hosted per-stage owner readback, desktop reload; fourth fixture clean journey also passed | Bounded smoke accepted, not all rules/content |
| Mobile 390x844 sheet/reload | Real installed Chrome, scoped visible identity/navigation | Bounded accepted |
| Private owner/nonowner/anonymous | Prior fixture SDK denial classification and isolated browser routes | Bounded accepted; broader campaign/content permissions untested |
| Guarded concurrent ability saves | Two SDK writes using actual application CAS filters, one winner/one stale no-match | Filter contract accepted; browser conflict UI untested |
| HP known precommit failure + independent absolute edit | New diagnostic scenario, no completed receipt | Unaccepted |
| Hit-die commit then response loss + reload | New diagnostic scenario, no completed receipt | Unaccepted; no blind retry permitted |
| Retained Rest hide-settle-Back on real Next | New diagnostic scenario, no completed receipt | Unaccepted |
| Two-tab relative HP commands | New controlled diagnostic, never completed | Unaccepted; overwrite risk follows inspected RPC, not a reproduced live loss |
| Equipment award interruption/duplication | Ordinary inventory path only | Atomicity unaccepted; separate proposal |
| Cleanup | First three exact-ID receipts; fourth remains live | Incomplete, blocked pending approval |

Prior detailed evidence: [mobile/private-access handoff](2026-10-03-mobile-access-acceptance.md), [request deduplication](2026-10-03-request-deduplication.md), [compatibility handoff](2026-10-02-builder-compatibility-review.md).

## Diagnostic safety and next decision

The play project depends on journey, uses the existing account configuration internally and routes only the exact fixture's state RPC. Rejection is injected before forwarding; response loss forwards once with fetch retries disabled and aborts only after server success. Retained lifecycle checks verify a busy dialog survives Back before settling while hidden. The two-tab scenario would record a blocked durability contract if both stale absolute HP patches overwrite one another; that is not a green concurrency verdict. Finally blocks release held handlers, drain both pages and audit exact owned rows. The first timeout interrupted teardown, so do not assume final audit/lock removal completed.

The harness now refuses a fresh diagnostic if the fixture already has spent hit dice or any roll history. This prevents replay of the lost-response spend through a whole-test retry. Tests have zero automatic retries. A partially completed scenario requires receipt/readback reconciliation and a deliberate scoped continuation; never reset spent dice and repeat the spend. Roll insertion currently precedes the state patch in a separate request, so state readback alone does not prove roll-history atomicity.

Recommended next decision: authorize exact-ID audit/cleanup of the remaining fixture first. If hosted play continuation is approved, reconcile current state/rolls and stale lock, run the bounded diagnostic on the same fixture only when its guard passes, then clean it. No further feature expansion or fixtures are needed for this pass.

The smallest durable implementation approval remains the existing [character action proposal](../specs/2026-10-02-durable-character-actions-proposal.md): revision participation for every relevant writer; character-scoped operation ID/fingerprint/result receipt; authenticated row-locked compare-and-apply transaction; hit-die spend/HP/accepted roll history in the same commit; receipt lookup before retry. Approve supported command kinds, roll authority and receipt retention/client recovery policy, then a disposable staging migration/replay and exact fixture test scope. The inspected void shallow-merge state RPC lacks no-match confirmation, CAS and durable receipts; no client gate can establish those guarantees. This is architectural evidence, not a result from the failed play run. Equipment grant atomicity stays a separate natural-key/provenance proposal. No schema or hosted SQL changes were implemented.

## Local validation and artifacts

Fresh production build passed with process-local nonsecret localhost public placeholders; no environment file was copied. npm run check passed: strict types, zero-warning lint, 211 files / 2,029 tests. After the final diagnostic replay guard, types and lint passed again. git diff --check passed. Source unchanged, no installation/push/merge/deploy or unrelated process/worktree changes.

Ignored durable journal/audit/mobile evidence: test-results/bounded-runs/c9e2c9a0-0440-4d10-88b3-313bef708a28. Main_PC Temp logs: inkborne-play-acceptance.txt (timeout), inkborne-play-diagnostic.txt (stale lock), inkborne-play-final-check.txt, inkborne-play-final-build.txt. There is no completed play-results.json. Earlier checkpoint copies in task-5 remain intact; separate play checkpoint copies preserve the live fourth-fixture journal/audit. Final TCP probe for port 3015 returned ECONNREFUSED; no unrelated process was stopped.
