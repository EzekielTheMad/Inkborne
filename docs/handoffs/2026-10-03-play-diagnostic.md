# Bounded play diagnostic and acceptance matrix - October 3, 2026

Superseded by the [HP locator/play checkpoint](2026-10-03-hp-locator-play-recovery.md): punctuation mismatch now proven and fixed; fifth fixture recovery results and final five-fixture cleanup are recorded there. The observations below describe the fourth-fixture checkpoint.

Application source remains 71681c77c6bff1d5f6f2d9e1a2d1f0ec107c4b4d. This checkpoint adds an independently reviewed diagnostic harness and records incomplete acceptance; no production or SQL change was made. Not release-ready.

## Evidence and current fixture

The new fourth fixture completed real hosted creation and the existing SRD journey/mobile checks: two tests passed in 28.1s, journey 18.1s. It exercised the same bounded Half-Orc/Barbarian/point-buy/Acolyte/equipment path as the preceding handoff. No expanded content or campaign fixtures were created.

The first play run timed out at 180 seconds without a completed scenario receipt. Its final snapshot was the sheet with HP 10/14; exact readback subsequently showed current_hp=10, temp_hp=0, hit_dice_spent={}. This establishes neither a gameplay regression nor a successful rejection/recovery test. A diagnostic continuation with 12-second action timeouts, 20-second navigation timeout and phase markers stopped before actions on EEXIST for the stale journal lock. Phase markers record entry, not success.

A process inspection confirmed no test Node worker remained (only an unrelated StreamDeck Node process). Automatic approval review then rejected the combined exact stale-lock removal and hosted continuation: the currently visible delegation forbids hosted writes/tests without further approval. That command did not execute. The parent then supplied Victor's explicit October 3 13:30:37 UTC approval transcript for up to six test characters using the two existing accounts, exact test-record cleanup and no schema changes. The older hosted prohibition was superseded within this narrow scope. The same denied command was retried once and approved; no review was bypassed. The verified stale lock was removed, and the existing fixture diagnostic ran. Never reset the journal or budget.

Run c9e2c9a0-0440-4d10-88b3-313bef708a28 has **four of six** creation attempts used and **two remaining**. **All four now have durable cleaned receipts.** The fourth fixture was bf573168-adcc-4162-a4fb-5fdb823745cf, owner e4b2972c-e54b-4940-ab27-75eb810f1dcf, name Inkborne bounded c9e2c9a0-0440-4d10-88b3-313bef708a28 4-builder. The final exact child audit at 15:05:39.029 UTC recorded 5 refs, 23 feature grants, 10 inventory and no rolls. The read-only cleanup plan contained only that character. Action-time approved cleanup revalidated exact owner/name/id, deleted the recorded fixture, verified the parent and all nine child scopes absent and persisted its cleaned receipt. No residual run-owned fixture is known. No name-prefix sweep or preexisting-record deletion occurred.

The approved single retry failed in 17.8s on locator.click at the exact HP trigger, with a 12-second timeout. play-results.json recorded scenario entry known-before-commit-hp-rejection but **zero intercepted requests, zero forwarded requests and no completed results**. The final accessibility snapshot contained the HP trigger; why the locator did not resolve during the action remains unproven. No gameplay action reached the injected route. This narrows the harness failure without establishing a product defect or SQL failure. No further fixture was created to repeat this failure.

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
| Cleanup | All four exact-ID receipts, parent/nine child scopes absent | Bounded cleanup complete |

Prior detailed evidence: [mobile/private-access handoff](2026-10-03-mobile-access-acceptance.md), [request deduplication](2026-10-03-request-deduplication.md), [compatibility handoff](2026-10-02-builder-compatibility-review.md).

## Diagnostic safety and next decision

The play project depends on journey, uses the existing account configuration internally and routes only the exact fixture's state RPC. Rejection is injected before forwarding; response loss forwards once with fetch retries disabled and aborts only after server success. Retained lifecycle checks verify a busy dialog survives Back before settling while hidden. The two-tab scenario would record a blocked durability contract if both stale absolute HP patches overwrite one another; that is not a green concurrency verdict. Finally blocks release held handlers, drain both pages and audit exact owned rows. The first timeout interrupted teardown, so do not assume final audit/lock removal completed.

The harness now refuses a fresh diagnostic if the fixture already has spent hit dice or any roll history. This prevents replay of the lost-response spend through a whole-test retry. Tests have zero automatic retries. A partially completed scenario requires receipt/readback reconciliation and a deliberate scoped continuation; never reset spent dice and repeat the spend. Roll insertion currently precedes the state patch in a separate request, so state readback alone does not prove roll-history atomicity.

Recommended next decision: diagnose the HP trigger locator/hydration timing from DOM evidence before spending another approved fixture attempt. Four of six attempts were used; two remain, and none should be spent on an unchanged blind retry. Gameplay rejection/response-loss/retained-Activity/two-tab acceptance remains outstanding. The preceding exact-ID cleanup is complete. No further feature expansion is proposed.

The smallest durable implementation approval remains the existing [character action proposal](../specs/2026-10-02-durable-character-actions-proposal.md): revision participation for every relevant writer; character-scoped operation ID/fingerprint/result receipt; authenticated row-locked compare-and-apply transaction; hit-die spend/HP/accepted roll history in the same commit; receipt lookup before retry. Approve supported command kinds, roll authority and receipt retention/client recovery policy, then a disposable staging migration/replay and exact fixture test scope. The inspected void shallow-merge state RPC lacks no-match confirmation, CAS and durable receipts; no client gate can establish those guarantees. This is architectural evidence, not a result from the failed play run. Equipment grant atomicity stays a separate natural-key/provenance proposal. No schema or hosted SQL changes were implemented.

## Local validation and artifacts

Fresh production build passed with process-local nonsecret localhost public placeholders; no environment file was copied. npm run check passed: strict types, zero-warning lint, 211 files / 2,029 tests. After the final diagnostic replay guard, types and lint passed again. git diff --check passed. Source unchanged, no installation/push/merge/deploy or unrelated process/worktree changes.

Ignored durable journal/audit/mobile evidence: test-results/bounded-runs/c9e2c9a0-0440-4d10-88b3-313bef708a28. Main_PC Temp logs: inkborne-play-acceptance.txt (timeout), inkborne-play-diagnostic.txt (stale lock), inkborne-play-diagnostic2.txt (approved retry/HP locator timeout), inkborne-play-audit.txt, inkborne-play-cleanup.txt, inkborne-play-final-check.txt, inkborne-play-final-build.txt. play-results.json contains phase entry and an empty results array, not a completed scenario. Earlier checkpoint copies in task-5 remain intact; separate play checkpoint copies preserve the live fourth-fixture journal/audit. Final TCP probe for port 3015 returned ECONNREFUSED; no unrelated process was stopped.
