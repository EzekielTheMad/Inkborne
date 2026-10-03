# Seventh bounded recovery and concurrency acceptance

**Not release-ready.** The corrected recovery scenario passed, and the controlled two-tab test demonstrated a gameplay durability defect. No application fix or schema change was made. Character builder priority and LegendKeeper/worldbuilding integration remain unchanged.

## Authority and scope

Victor approved one additional temporary character on October 3 at 22:04:25 UTC (“Yeah, go for it. No need to ask for something small.”), responding to an explicit one-extra-fixture recovery/two-tab request. Parent confirmed the refreshed Trello claim before hosted mutation. Scope stayed at project etcaodglvcspcmwecyxq, the same two existing accounts, and original run c9e2c9a0-0440-4d10-88b3-313bef708a28. No accounts, schema, RLS, timeouts, credentials, rules, deployment or publication changes.

The runner retains its default six-attempt limit. An exact run-ID opt-in permits only attempt seven after all six previous cleanup receipts; hard maximum seven. Default denial, wrong-run denial, uncleared predecessor denial, restart/cleanup and eighth-attempt denial are covered locally. No replacement journal or budget reset.

## Current acceptance matrix

| Area | Outcome and scope |
| --- | --- |
| Relative HP failure dependency | Local actual UI/actions regression accepted: failed pending damage does not contaminate hit-die healing; independent absolute edits preserved. |
| Hidden dialog lifecycle | Local actual retained Activity cast/rest/effect recovery checks accepted. Real Next page navigation remounts; hosted Back reopened a fresh dialog, as expected for current configuration. |
| Builder choices/pinned references | Hosted bounded existing SRD journey, owner readback, equipment, desktop and mobile reload accepted. Complete RAW/content breadth remains unaccepted. |
| Private access | Existing nonowner/anonymous SDK denials and browser 404/login redirects accepted in the prior bounded scope; broader authorization/expired sessions untested. |
| Guarded ability writes | Prior SDK compare-and-set application filters: one confirmed writer, one stale no-match, guarded restore. Not proof of gameplay safety. |
| Known HP failure | Fifth-fixture guaranteed precommit rejection followed by independent temp HP edit accepted. |
| Ambiguous hit-die commit | Fifth-fixture one server commit with browser response lost, one roll/die reconciled after reload without blind retry. Isolated recovery accepted; durable idempotency/atomicity unproven. |
| Rest while navigating | Seventh-fixture captured held request, zero-forward known rejection while away, complete baseline preserved. Back lifecycle dialog-reopened, no inherited pending/error, reopening caused no write. Completed receipt. |
| Explicit recovery/reload | Seventh-fixture known-no-commit retry forwarded once, HP 14/die restored, roll history unchanged, reload confirmed; full-HP Spend disabled/title HP is already full and recovered 1/1 pool passed. Completed receipt. |
| Two-tab relative HP | **Durability failed:** both tabs read 10; damage 2 saved 8; damage 3 from stale10 saved 7. Both writes completed, first tab displayed 8, second 7; reload confirmed 7. Serial intent should yield 5. No further dependent gameplay action. |
| Equipment atomicity | Normal builder path persisted; atomic grants/ambiguous failure remain separate unverified risks. |

## Exact reproduction and smallest corrective proposal

Two pages in the same approved owner browser context loaded the same fixture at HP 10/temp 0. Route gates held their outgoing state RPCs without retries. Tab A submitted Damage 2; tab B submitted Damage 3. Tab B request patch was asserted current_hp 7. A was forwarded once, database readback reached 8; B then forwarded once, database readback reached 7. Both HTTP responses were successful and both UI actions finished. Tab A remained 8, B 7, and A reload reconciled 7. This is a stale relative-intent overwrite in two same-owner tabs; it does not claim separate-user/session/device coverage. The first raw request patch is not saved in the receipt; the reproduction uses its actual damage control, successful response and ordered database readback.

Smallest fix for this defect: owner-checked conditional HP/temp-HP write, atomically checking the caller's expected relevant state and returning explicit applied/conflict/missing status. On conflict, reload and show a readable conflict; never automatically replay the damage. A compare-and-set RPC under the database lock can reject the stale B write without introducing a general ledger. Separate durable action receipts/idempotency and combined roll/state transaction address the previously observed ambiguous commit problem; they are broader work. Equipment grant atomicity remains separate. No SQL or hosted implementation was attempted; design/schema changes need separate approval. The existing raw receipt's requiredDecision mentions receipts together with conditional writes; this proposal clarifies that receipts are not the smallest prerequisite for preventing this particular overwrite.

## Run, cleanup and evidence

Seventh character: 2c1357fa-d623-4a72-92d8-2656b0f25f46; owner e4b2972c-e54b-4940-ab27-75eb810f1dcf; reservation 1a3537bd-7510-4cd5-9b49-8dcd7afe6f04. Same original durable journal; **all seven now cleaned, zero attempts remaining**.

Command: npm run test:e2e:bounded -- --project remaining, with original project/run/local3015 gates, remaining scope and exact seventh-run opt-in. Result **3 passed in 47.5s**: creation 4.4s, journey 18.9s, remaining 17.5s. These are green diagnostic assertions including the expected unsafe outcome, not a passed durability contract. Completed receipt at 22:07:46.243 UTC records accepted rest rejection, accepted confirmed retry and blocked-durability-contract. Main-page counters exclude the separately routed second page; do not interpret them as all-tab totals.

After test completion and drained route handlers, exact-ID cleanup revalidated owner/name, deleted only the seventh parent and verified parent plus all nine child scopes absent; durable cleaned receipt appended. Previous six cleanup receipts preserved. No dependent retries or eighth creation. Test server 3015 is stopped.

Local checks passed: single-gate/cleanup tests 13; full npm run check (types, lint, 211 files / 2,030 tests); npm run build with process-local localhost placeholders. This adds one meaningful manifest test. Independent read-only review found no substantive issues or acceptance overclaims. No test server remains running.

Nonsecret evidence copies under task-5: inkborne-seventh-fixtures.jsonl, inkborne-seventh-owned-rows.json, inkborne-seventh-play-results.json, inkborne-seventh-play-dom.json and inkborne-seventh-mobile-dom.json. Prior fifth/sixth copies preserved. Temp logs: inkborne-seventh-gate-tests.txt, inkborne-seventh-preflight.txt, inkborne-seventh-pass.txt, inkborne-seventh-cleanup.txt, inkborne-seventh-check.txt and inkborne-seventh-build.txt. No secret file copied or settings printed.

## Remaining limits and decision

Do not publish. Resolve the demonstrated conflict contract before declaring cross-client gameplay safe. Durable ambiguous-write/roll receipts and equipment atomicity need separately scoped design approval. Full rules, cast slots/concentration, campaigns/DM/public/retired/inaccessible content, broader auth, offline recovery and arbitrary interleavings remain unaccepted. Earlier 57014 timeout cause is unproven; request-scoped deduplication is not proof of a hosted timeout fix. No migration, install, push, merge or deployment occurred.

See [sixth-run matrix](2026-10-03-final-bounded-acceptance.md) for historical evidence and original fixture IDs, [fifth response-loss proof](2026-10-03-hp-locator-play-recovery.md), and [Next lifecycle proof](2026-10-03-rest-remount-final-plan.md).
