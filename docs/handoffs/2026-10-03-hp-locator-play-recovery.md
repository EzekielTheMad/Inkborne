# HP locator proof and bounded play recovery - October 3, 2026

This checkpoint fixes the test locator only. Application source remains 71681c77c6bff1d5f6f2d9e1a2d1f0ec107c4b4d. No application defect or hosted concurrency guarantee is inferred. Not release-ready.

## Exact cause and local regression

The actual HPTracker accessible label is “HP tracker — click to heal or damage”, containing U+2014 EM DASH. The previous exact test label contained U+002D HYPHEN-MINUS. Reading UTF-8 code points exposed the difference that the terminal's rendered snapshot obscured. The HP control was present; the locator matched a different string.

e2e/bounded/sheet-locators.ts now scopes to the Character Sheet tabpanel and matches the stable /^HP tracker\b/ semantic prefix. It selects one accessible control without choosing the first mounted copy or depending on punctuation. The play test also verifies selected sheet tab, one HP control and visibility before interacting.

scripts/verify-hp-trigger-local.mjs is an isolated installed-Chrome regression using actual SheetPanel, StatRibbon, MobileSheet, HPTracker, provider and tabs with production CSS. Only navigation/content tab boundaries and persistence are simulated. It reads no environment configuration and blocks all nonlocal requests. At 1280x900 and 390x844 it recorded two mounted raw HP labels, the old exact locator count 0, shared semantic locator count 1, successful popover opening and actual Damage saving HP 8 from 10. Both browser snapshots and screenshots are retained. No page errors or remote attempts occurred. Independent read-only review found no blocking locator/safety issue.

This proves actual responsive components and the shared helper, not real Next lifecycle or backend durability. The hosted desktop viewport was 1280x720; sanitized play-dom.json confirmed the real character sheet route, selected sheet tab, one accessible HP control, two mounted labels and initial HP10/temp0/no spent dice. The helper then successfully drove real sheet actions, confirming the punctuation fix rather than a viewport/route/hasSheet rendering defect. Mobile hosted HP interaction remains local-only tested; previous real mobile identity/navigation/reload evidence is retained separately.

## One new hosted fixture and actual results

Victor's superseding bounded approval applies only to project etcaodglvcspcmwecyxq, two existing accounts, tracked fixtures/children and no schema/security/credential changes. One fifth fixture was reserved before creation: bc1a82b3-9fda-4f8f-8073-d916bff081c7, owner e4b2972c-e54b-4940-ab27-75eb810f1dcf, name Inkborne bounded c9e2c9a0-0440-4d10-88b3-313bef708a28 5-builder. The run journal is c9e2c9a0-0440-4d10-88b3-313bef708a28.

The single invocation --project play ran its creation/journey dependencies and no automatic retries. Creation passed in 4.7s; journey/mobile passed in 18.6s. Play completed two scenarios then failed in 29.4s; overall **two tests passed, one failed, 59.2s**. Do not describe this as a green full suite.

| Scenario | Actual result | Acceptance boundary |
| --- | --- | --- |
| Existing SRD creation/builder/mobile journey | Pass | Same bounded Half-Orc/Barbarian/point-buy/Acolyte/equipment smoke, not all content or computed rules |
| Known rejection before HP commit | Pass | One intercepted damage request, zero forwarded; database HP stayed10, readable HP failure shown |
| Independent absolute edit after rejection | Pass | Temp HP3 persisted; HP remained10 |
| Hit die committed, HTTP response lost | Pass, isolated reconciliation | Forwarded once with fetch retries disabled; success received by harness then response aborted; readable UI error |
| Reload after lost hit-die response | Pass, isolated reconciliation | One spent Barbarian die, one roll; rolled HP/state patch read back; available die0 and Spend disabled after reload; no blind retry |
| Real Next retained Rest hide/Back | Unaccepted diagnostic failure | First Back did not reveal the previously opened Rest dialog; failed before retained pending state or hidden settlement was proven |
| Hidden settle then Back | Not reached | Local simulated Activity tests remain useful, but real Next lifecycle not established |
| Two-tab relative HP writes | Not reached | No hosted concurrency verdict or reproduced lost update |
| Exact cleanup | Pass | Fifth parent and all nine child scopes absent; durable cleaned receipt |

The real Next Back observation differs materially from the isolated retained Activity fixture. The test did not prove that the page retained the same dialog session. It is a diagnostic symptom, not a demonstrated use-dialog-action defect or permission to rewrite navigation. No further hosted retry or fixture creation occurred. The final reserved attempt remains untouched.

Scoped postfailure readback showed HP10, tempHP0 and hit_dice_spent={barbarian:1}; the HP/temp values came from the deliberate setup reset before the Rest scenario. Final child audit at 15:12:09.374 UTC recorded 5 refs, 23 feature grants, 10 inventory and one roll. play-results.json contains two completed scenario receipts plus entry into retained-rest-hide-settle-back. Its request counters are phase-entry counters and cannot establish final teardown request totals. Sanitized actual-state and DOM evidence is preserved; no credentials, account details or unrelated narrative were captured.

Response-loss reconciliation is limited to this isolated observed command. Current HP is not a durable receipt. Roll insertion is a separate request before the state patch, so this does not prove rollback/transaction atomicity, safe repeated commands or cross-client outcomes. The existing [durable action proposal](../specs/2026-10-02-durable-character-actions-proposal.md) still requires a separate implementation decision/SQL approval; [equipment atomicity](../specs/2026-10-02-equipment-atomicity-proposal.md) remains separate. No SQL was implemented.

## Cleanup, checks and next decision

The read-only cleanup plan contained only bc1a82b3-9fda-4f8f-8073-d916bff081c7. Approved deletion revalidated owner/name/id and verified parent plus all nine child scopes absent, then persisted its cleaned receipt. **Five of six creation attempts used, all five cleaned; one final attempt remains reserved.** Port3015 returned ECONNREFUSED; no unrelated process/worktree was changed.

The shared-helper offline regression passed at both viewports. npm run check passed: strict types, zero-warning lint, 211 files / 2,029 tests. Fresh Next 16.2.10 production build passed with process-local nonsecret localhost public placeholders. git diff --check passed. No install, schema/security/credential change, push, merge or deployment occurred.

Recommended next decision: inspect real Next page/session retention with a local Next route fixture before spending the reserve. Establish whether this sheet-to-builder route is intended to retain the dialog, then test that actual lifecycle. Do not infer Activity retention from browser Back alone or change product navigation from this symptom. Cross-tab play acceptance remains blocked by incomplete evidence, with the inspected shallow-merge RPC's architectural risks documented independently. This checkpoint adds no speculative feature.

Evidence: ignored test-results/hp-trigger-local contains evidence.json, snapshot-1280.txt, snapshot-390.txt and screenshots; bounded-runs/c9e2c9a0-0440-4d10-88b3-313bef708a28 contains journal, play-dom.json, play-results.json, child audit and mobile identity evidence. Separate task-5 inkborne-hp-play-* copies preserve this fifth checkpoint without replacing earlier fourth-fixture copies. Temp logs: inkborne-hp-local-proof.txt, inkborne-play-fifth.txt, inkborne-play-fifth-cleanup.txt, inkborne-hp-final-check.txt, inkborne-hp-final-build.txt. Earlier [play diagnostic](2026-10-03-play-diagnostic.md) and [mobile/access handoff](2026-10-03-mobile-access-acceptance.md) remain historical evidence.
