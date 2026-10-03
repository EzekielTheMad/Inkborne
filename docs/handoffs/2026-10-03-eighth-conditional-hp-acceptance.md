# Applied conditional HP acceptance — October 3, 2026

**Not release-ready.** Victor approved the new owner-only endpoint and one eighth temporary fixture at 22:30:21 UTC; parent confirmed the Trello claim before mutation. Target development project etcaodglvcspcmwecyxq. Local application integration is prepared and tested; no app deployment, push, merge or publication.

## Applied database scope

Only public.patch_character_state_if_current(character_id uuid, expected_state jsonb, state_patch jsonb), returning TABLE(status text,resulting_state jsonb), was added. SECURITY INVOKER, empty search_path, explicit auth.uid() owner predicate and unchanged SELECT/UPDATE RLS. It locks the owner row, compares the complete raw state, then shallow-merges only on equality. Outcomes applied/conflict/missing; missing/inaccessible returns null state.

Managed MCP migration history generated actual versions, preserved verbatim locally (no invented timestamps):

- 20261003223252_conditional_character_state_owner_cas.sql: new endpoint and PUBLIC/anon revoke/authenticated grant.
- 20261003223324_conditional_character_state_authenticated_only.sql: project default privileges initially added service_role execution; verification detected it and it was revoked on this new function before fixture testing, matching approved authenticated-only scope.

Final effective execution: authenticated true; anon, PUBLIC and service_role false; owner postgres retains normal owner privilege. ACL {postgres=X/postgres,authenticated=X/postgres}. No existing table/column/index/policy/RPC changed. Old RPC definition hash e88103933fc1c4588eab01fb7700232a and character policy fingerprint fa62ad57f966f71426ddc98dd5aed86b matched preflight; RLS true. Rules/SRD were read only, and fixture-owned character data was the only application data changed.

Supabase CLI/psql/Docker were unavailable; approved hosted DDL used the MCP migration tool, and files use its actual returned versions. Do not replay applied migrations onto this project. [Manual rollback](../architecture/proposals/conditional-character-state-rollback.sql) drops only the new signature after reverting local conditional activation and checking callers. Rollback was not executed; no data restore is required beyond exact fixture cleanup.

Security advisor groups/counts before/after were unchanged: two RLS-enabled/no-policy import tables, 25 existing authenticated security-definer endpoints, and one password-protection warning. No new endpoint advisory; unrelated existing objects/settings were untouched. Existing guidance: [RLS linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [definer linter](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Local client scope

CharacterProvider retains character.state as the raw expected snapshot, separate from initializeState display defaults. State writer advances this snapshot only after successful persistence and uses canonical conditional results. Provider patches containing current_hp or temp_hp use the new RPC; non-HP writes/callers without a snapshot retain the existing contract. This covers current provider Damage/Heal/temp-HP and HP-containing rest/hit-die patches; it does not introduce general rule validation or action receipts.

Conflict/missing/transport uncertainty is readable and never falls back to the old RPC. Further HP writes and state-dependent actions are blocked until explicit full reload creates a fresh provider. No automatic damage/healing replay. Independent queued absolute writes remain eligible; reload waits for the queue to drain. Typed error text remains visible in the HP popover. A post-hosted local hardening added pending-write reload disabling and canonical-result publishing; regression verification covers that small delta, with no additional hosted rerun.

## Current acceptance matrix

| Area | Current evidence and limit |
| --- | --- |
| Conditional owner RPC | Hosted concurrent same-snapshot SDK writes: exactly one applied, one conflict, complete winner state preserved. Winner was damage3/HP7 in this unordered SDK phase. |
| Stale healing | Hosted stale healing returned conflict; complete current owner state unchanged. |
| Access/invalid outcomes | Existing nonowner returned missing/null, anonymous returned 42501, random missing ID returned missing/null, malformed snapshot returned 22023. No character created for missing-ID probe; owner state unchanged after denials. |
| Actual same-owner two tabs | Both raw snapshots 10, patches 8 and 7 captured. A confirmed 8; B conflict, optimistic HP rolled back 10, readable Reload character. Complete DB remained 8. Both raw requests and responses preserved in receipt. |
| No replay | Clicking blocked Damage again caused zero requests and did not change DB 8. Reload itself caused zero write. |
| Explicit recovery/new action | Actual Reload character reset provider/current HP 8; then a new user Damage 3 saved 5; reload verified 5. This is a newly chosen action, not automatic replay of stale intent. |
| Prior builder/private/mobile | Existing bounded SRD builder, pinned refs, equipment/readback and mobile/private access acceptance retained; eighth creation/journey passed again. Broader rules/content/auth unaccepted. |
| Prior failed relative dependency/Activity | Local actual UI dependencies and retained Activity regressions retained. Current real Next navigation remount semantics previously proved; new endpoint rest/navigation response-loss lifecycle not rerun hosted. |
| Ambiguous write/roll/equipment | Prior isolated response-loss reconciliation remains historical. New conditional transport-loss no-retry behavior is locally tested; durable action identity and atomic roll/equipment outcomes remain unproven. |

## Run and exact cleanup

Original run c9e2c9a0-0440-4d10-88b3-313bef708a28 was never reset. Eighth reservation 0b94b5f5-bab7-4e0d-a884-9b1f3837030b; character ae23a904-40a5-4e39-90ff-10f2b748f1d9; existing owner e4b2972c-e54b-4940-ab27-75eb810f1dcf. Separate exact-run eighth opt-in, seven preceding cleanup receipts, hard maximum 8. No ninth authorized.

Command npm run test:e2e:bounded -- --project conditional with original project/run, eighth gate, scope conditional and local 3015. **3 passed in 44.9s**: create 5.2s, journey 18.6s, conditional 14.8s. Receipt completed 22:39:46.056 UTC. Route fetch maxRetries 0; held requests drained/aborted on teardown, manifest and account closure guaranteed.

Exact-ID cleanup after the run revalidated owner/name and verified parent plus all nine child scopes absent; durable eighth cleaned receipt appended. All eight now cleaned, zero outstanding IDs and zero creation attempts remaining. Test server 3015 stopped. No secrets copied or values printed; existing authorized env file loaded only through allowlisted runner settings.

## Verification and evidence

Pre-hosted focused local integration: 47 tests, types and lint passed. Final npm run check passed (types, lint, 212 files / 2,048 tests); fresh production build passed with process-local localhost placeholders. Seven actual-provider/retained-Activity Chrome regressions also passed with simulated persistence and no hosted calls. Initial full check found four hit-die assertions still expecting the old two-argument helper call; updated them to verify exact raw snapshots (including confirmed first spend on the second call), then reran to green. Independent read-only review accepted the source/evidence framing; its failure-path route-drain finding was corrected before final checks. New meaningful tests cover raw versus display snapshots, no fallback/retry on malformed/uncertain replies, sticky reload boundary, independent queued notes and eighth authorization. Actual provider regression verifies pending notes keep Reload disabled until completion. Supabase/Next installed docs and React checklist were consulted; existing dependencies reused.

Ignored original-run receipts are copied without overwriting historical fifth/sixth/seventh evidence to task-5 inkborne-eighth-{fixtures.jsonl,owned-rows.json,conditional-hp-results.json,mobile-dom.json}. Catalog/grant/migration/advisor summary also preserved. Temp logs: inkborne-eighth-preflight.txt, inkborne-eighth-integration-tests.txt, inkborne-eighth-types.txt, inkborne-eighth-lint.txt, inkborne-eighth-pass.txt, inkborne-eighth-cleanup.txt, inkborne-eighth-check.txt and inkborne-eighth-build.txt.

## Compatibility limits and next gates

Older clients/unconditional RPC/direct updates can still overwrite after a guarded write. This bounded endpoint/local-client test does not establish universal concurrency safety. A coordinated rollout/legacy-writer decision is needed before such a claim; no old permission was changed under this approval. Snapshot CAS is not an event revision and does not detect ABA or changed derived inputs outside state. Complete rule validation, campaign/DM/public/content breadth, offline/expired-auth recovery, cast/concentration interleavings and arbitrary multi-client histories remain unaccepted.

Hit-die roll insertion still occurs separately before the state write; a conflict can leave a roll without its matching state change. Durable receipts and roll/equipment transaction atomicity remain separate approvals. Do not publish. Further hosted fixture creation requires new scope; no application deployment has been authorized or attempted. Historical [seventh reproduction](2026-10-03-seventh-recovery-concurrency.md) remains the before evidence; [proposal](2026-10-03-conditional-hp-proposal.md) is historical unapplied status superseded here.
