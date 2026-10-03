# Mobile and private-access acceptance — October 3, 2026

Application source remains 71681c77c6bff1d5f6f2d9e1a2d1f0ec107c4b4d. This checkpoint changes the bounded harness/tests/docs only. No application defect was established by the locator failures; no production rewrite, schema/settings/security change, account creation, push or deployment occurred.

## What was actually exercised

All browser runs used installed Chrome against the real local Next app and approved hosted project etcaodglvcspcmwecyxq, using the two existing approved accounts. Persistence was not simulated. The exact-ID journal run is c9e2c9a0-0440-4d10-88b3-313bef708a28.

One new fixture, 8e01a2d6-f0c7-4a79-beed-0c8948a717b9, was reserved before creation and recorded after insertion. Total **three of six** creation attempts across the task; all three now have cleaned receipts; **three remain**.

The fresh journey exercised every stage planned in this SRD smoke scenario: Half-Orc race; level-1 Barbarian and active class-feature restoration; Athletics/Perception; six point-buy ability values; Acolyte background and Dwarvish/Elvish; starting equipment selection/confirmation; Finish -> desktop sheet -> reload. Authenticated owner database reads verified choices/base scores after each stage, and saved refs with content/version IDs plus inventory after sheet refresh. Audit recorded 5 refs, 23 feature grants and 10 inventory rows.

This does not establish all races/classes/subclasses/levels, RAW correctness of every derived stat, all historical-pin provenance, equipment atomicity or a complete playable-character acceptance. No spells, rolls, campaign/content/account fixtures were created. The ordinary equipment path persisted inventory; interruption or duplicate award behavior is not accepted.

## Mobile DOM and clean result

The mounted desktop and mobile headers are switched by CSS. On mobile, the exact name is a visible paragraph; the desktop h1 is hidden. A page-wide Inventory button query also encounters repeated buttons in mounted panels.

Harness locators now use the paragraph role/name text and the Character Sheet tabpanel's navigation for Stats/Inventory controls. The new fixture's first journey failed only the newly added unscoped Inventory assertion after identity/tab checks had passed. DOM/accessibility evidence identified the scope; one same-fixture continuation used --project journey --no-deps and passed in 14.2s (18.8s including runner/server). No second fixture or broad cleanup was used to solve it.

At 390x844, the clean run verified one visible name paragraph, selected Character Sheet tab, visible scoped Stats/Inventory controls, then reloaded and verified mobile identity/tab again. mobile-dom.json records tag P, paragraph count 1, visible name headings 0, selected tab true and mobile reload verified. The previously untested mobile correction is now live-verified.

Fresh creation/builder refresh/secondary update-attempt test passed separately. The whole three-project suite was not rerun as a single uninterrupted invocation: create passed in the initial run, journey passed in its controlled same-fixture continuation, then access passed after journey. Report these per-scenario results rather than a fabricated single-suite green result.

## Owner/nonowner/anonymous and concurrency results

A new access project depends on journey. The executed --project access --no-deps reused the same recorded private fixture, created no additional row, and passed in 6.9s (11.3s including runner/server).

| Scenario | Observed result | Scope |
| --- | --- | --- |
| Owner reads and persistence | Pass | Correct exact owner/name; hosted choices/base-score readbacks; sheet/ref/inventory refresh |
| Nonowner private character read | Pass | No returned rows; no error |
| Nonowner private name update | Pass | No returned rows; owner name unchanged |
| Nonowner private reference read | Pass | No returned rows |
| Anonymous private character read/update | Pass | No returned rows; owner name unchanged |
| Anonymous reference read | Pass | PostgreSQL permission denial 42501 |
| Nonowner sheet and builder browser routes | Pass | Isolated secondary login; HTTP 404, fixture name absent |
| Anonymous sheet and builder browser routes | Pass | Separate unauthenticated context; login redirects, sign-in control visible, fixture name absent |
| Concurrent guarded ability writes | Pass | Two differing updates from the same baseline; exactly one returned row, the stale competitor returned zero; winning stats read back |
| Guarded restoration | Pass | Base scores restored and read back; choices verified unchanged before restoration and preserved by the guarded update |

The earlier “desktop builder-to-sheet passed” claim included real hosted persistence and all five builder stages in the planned smoke, not all product functionality. Earlier nonowner coverage was only zero-row update plus unchanged owner readback; this checkpoint adds explicit denial classification, private reads/refs and browser route separation. Timeout/network/other errors are not counted as denials: tests accept only zero rows or 42501.

Concurrency uses SDK updates with the same choices/base_stats compare-and-set filters as the application ability-save path. It tests that hosted filter contract, not the actual browser conflict UI, unguarded whole-state writes, serialized HP/cast/rest behavior, or after-commit response loss. Both candidates differ from baseline, avoiding a no-op competitor. Restoration requires unchanged baseline choices and a known candidate/baseline stats state before applying a conditional update; an unexpected edit would halt instead of being overwritten.

Independent read-only review caught unsafe generic restoration and missing baseURL in isolated contexts. Both were corrected before live access execution. The contexts receive the validated local baseURL explicitly. New unit coverage verifies browserLogin selects only the existing secondary account; its existing login-error sanitization test still passes. Browser contexts close and SDK task sessions sign out locally; no claim is made that all historical account sessions were revoked.

## Checks, logs and timeout interpretation

npm run check: types/lint passed, **211 files / 2,029 tests**. Focused browser-login tests: two passed. Production source is unchanged from the preceding successful 71681c7 build; this harness-only checkpoint did not rerun that build. git diff --check passed.

Read-only log window 14:38:30–14:42:15 UTC: zero PostgreSQL 57014 errors, zero fixture-scoped HTTP 500s. The observed clean mobile/access run does not establish a database timeout fix or explain prior cancellations. Earlier query-profile and deduplication handoffs retain the unresolved cause and incomparable timing evidence.

Main_PC Temp logs:
- inkborne-mobile-acceptance.txt: create passed; fresh journey failed unscoped Inventory locator.
- inkborne-mobile-continuation.txt: clean journey/mobile pass.
- inkborne-access-acceptance.txt: private-access/guarded-concurrency pass.
- inkborne-mobile-final-check.txt: final 211-file / 2,029-test check.
- inkborne-mobile-cleanup.txt: exact-ID cleanup result.

## Cleanup and remaining blockers

The reviewed cleanup plan contained only 8e01a2d6-f0c7-4a79-beed-0c8948a717b9. Action-time reviewed execution revalidated owner/name/id, deleted that fixture and verified the parent and all nine child scopes absent, then appended a durable cleaned receipt. The first two cleaned receipts remain intact; no residual run fixture is known. Preexisting rules/content/campaigns/characters and other worktrees were untouched. No cleanup swept a prefix.

Ignored durable evidence includes fixtures.jsonl, mobile-dom.json, access-results.json and owned-rows.json under test-results/bounded-runs/c9e2c9a0-0440-4d10-88b3-313bef708a28. Separate task-5 copies preserve this checkpoint without replacing earlier receipts.

All servers used the isolated checkout and port 3015. Initial server PID3256 (launchers29144/1396), continuation PID34496 (launchers34476/6344), access PID33496 (launchers29056/6628); logs retain further worker PIDs. Playwright stopped its servers, and final TCP probe returned ECONNREFUSED. No unrelated process was stopped.

Still unaccepted: real HP/cast/rest retained Activity recovery; denied content, expired auth/offline recovery; campaign/DM/public/retired variants; full cross-client/state concurrency; ambiguous response loss; equipment award atomicity; full computed-rule correctness. Durable action/equipment designs remain separate proposals requiring explicit hosted/schema approval. Not release-ready.

