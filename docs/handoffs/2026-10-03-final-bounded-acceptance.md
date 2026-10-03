# Final bounded acceptance — October 3, 2026

Historical sixth-run checkpoint. Superseded by the separately approved [seventh-run recovery/concurrency evidence](2026-10-03-seventh-recovery-concurrency.md); all seven fixtures are now cleaned and the two-tab defect is demonstrated.

**Not release-ready.** Branch codex/playable-core-stability; application source remains 71681c77c6bff1d5f6f2d9e1a2d1f0ec107c4b4d. Final changes correct test assertions and consolidate evidence; no application behavior, schema, credentials or hosted settings changed. Character builder priority and LegendKeeper/worldbuilding integration remain intact.

## Acceptance matrix

| Area | Evidence and limit |
| --- | --- |
| Failed relative HP dependency | Local actual UI/action regression: failed pending damage cannot contaminate subsequent hit-die healing; independent absolute edits retained. |
| Hidden dialog completion | Local actual React Activity cast/rest/effect checks preserve generations and reveal completion/error recovery once. Current Next page navigation remounts instead. |
| Builder choices and references | Hosted bounded SRD Half-Orc/Barbarian/Acolyte journey, point buy, skills/languages/equipment and pinned references verified through owner readback and desktop/mobile reload. Broader rules and content remain unaccepted. |
| Private access | Existing nonowner/anonymous SDK denials and browser 404/login redirects verified. Broader authorization and expired sessions untested. |
| Ability conflict filters | Two SDK writes using application compare-and-set filters: one confirmed writer, one stale no-match; guarded restore. This does not prove browser conflict UI or relative gameplay concurrency. |
| Known HP rejection | Fifth fixture: guaranteed precommit rejection, then independent temp HP edit persisted without failed damage. Completed receipt. |
| Lost hit-die response | Fifth fixture: one forwarded commit, browser response lost, readable error, persisted state/die/one roll reconciled after reload without blind retry. Isolated outcome only; no durable command receipt or atomic roll/state guarantee. |
| Rest rejection during navigation | Sixth fixture: captured request rejected with zero forwards while on builder; complete persisted baseline unchanged. Back remounted; fresh reopening had no inherited pending/error and caused no write. Completed receipt. |
| Explicit rest retry/reload | Sixth fixture: one confirmed forwarded retry restored HP14/temp0/Barbarian spent0, zero rolls unchanged, reload showed HP14 and no pending/error. These assertions preceded a harness failure; no completed retry receipt or green suite. |
| Full HP rest control | Harness incorrectly expected Spend & Roll enabled after full healing. Product correctly disables it with title “HP is already full.” Assertion corrected to disabled/title plus recovered pool 1/1; offline real Next proof passes. No hosted rerun. |
| Two-tab relative HP | Never reached in any hosted run. No live lost-update reproduction; remains unaccepted. |
| Equipment atomicity | Ordinary builder grant/readback path accepted only. Atomicity and ambiguous failure recovery unverified. |

## Final run and cleanup

Approved project etcaodglvcspcmwecyxq; two existing accounts; durable run c9e2c9a0-0440-4d10-88b3-313bef708a28. Final remaining-scope invocation completed **2 passed, 1 failed in 57.4 seconds** (create 5.0s, journey 18.2s, remaining failure 27.7s). Failure was the full-HP enabled assertion above. Gameplay retries stopped; no seventh fixture or replacement journal.

All six recorded IDs were exact-ID cleaned, with owner/name guards and parent plus nine child scopes verified absent:

- b7099e42-1781-48d2-8e39-5472e61609b1
- 0f569bf2-4533-44fe-8bcf-b16b48327cb6
- 8e01a2d6-f0c7-4a79-beed-0c8948a717b9
- bf573168-adcc-4162-a4fb-5fdb823745cf
- bc1a82b3-9fda-4f8f-8073-d916bff081c7
- acf09f79-04fd-4548-9738-d9298ffcfb49

Six of six attempts used; zero remain. Final fixture scoped readback before cleanup confirmed HP14/temp0/spentBarbarian0. Audit at 15:36:15.527 UTC: five references, 23 feature grants, ten inventory rows, zero rolls; other child counts zero. Cleanup receipt is durable in fixtures.jsonl. Phase-entry counters in play-results.json are not final request totals.

## Verification and supporting files

Final local commands: npm run check (types, lint, **211 files / 2,029 tests**); npm run build with process-local localhost placeholders; node --import tsx scripts/verify-next-rest-local.mjs. All passed. The real Next16.2.10 fixture proves mount/unmount/Back fresh reopening, known rejection, explicit rest recovery/reload, full-HP disabled control and available die 1/1: two requests, zero blind retries. It uses isolated webpack/local persistence and matching page ownership/cache configuration, not full hosted authentication or production bundling. Separate local retained-Activity suite has seven checks; desktop/mobile HP semantic locator proof has two viewport checks.

Durable ignored evidence: test-results/bounded-runs/c9e2c9a0-0440-4d10-88b3-313bef708a28/{fixtures.jsonl,owned-rows.json,play-results.json,play-dom.json,mobile-dom.json}; test-results/next-rest-local/evidence.json. Copies under task-5 use inkborne-final-* and preserve earlier fifth-fixture files. Temp logs: inkborne-final-sixth-pass.txt, inkborne-final-sixth-cleanup.txt, inkborne-final-full-hp-local.txt, inkborne-final-consolidated-check.txt, inkborne-final-consolidated-build.txt. No secret file copied or values exposed.

## Risks and next decision

The response-loss case demonstrated an error despite a committed action, recoverable in the isolated fixture. Source inspection shows shallow whole-state RPC updates without revision/affected-row confirmation or durable receipts, and a separate roll insert before the state patch. Session gates do not establish cross-client safety. These are architectural risks; the two-tab lost update was **not demonstrated live**. Equipment failure atomicity remains a separate risk. A minimal durable design would combine revision/intent validation and an idempotent action receipt with the resulting state/roll or equipment mutation in one transaction. Receipts alone cannot correct stale relative intent. Schema/hosted implementation requires separate approval.

Earlier hosted 57014 statement timeouts were observed; cause remains unproven. Request-scoped read deduplication does not establish a timeout fix or full performance acceptance. Cast slots/concentration, complete RAW correctness, campaign/DM/public or retired/inaccessible content, broader authorization, offline/expired-auth recovery and arbitrary ambiguous interleavings remain unaccepted.

Do not publish. Corrected harness is ready locally, but additional hosted fixture runs require new bounded approval because the budget is exhausted. Next acceptance should cover the corrected rest scenario and two-tab relative HP, followed by a separate decision on durable conflict/atomicity design. No push, merge, deployment, migration or installation occurred. Historical detail: [fifth HP evidence](2026-10-03-hp-locator-play-recovery.md), [Next remount proof](2026-10-03-rest-remount-final-plan.md), [mobile/access](2026-10-03-mobile-access-acceptance.md).
