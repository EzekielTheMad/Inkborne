# October 3 bounded acceptance checkpoint

Branch `codex/playable-core-stability`; starting HEAD `0cd5a6d`. Application source remains the October 2 candidate `d69be9d`; this checkpoint adds the dedicated acceptance harness and documentation. **Not release-ready.**

## Authority and execution

Victor approved bounded acceptance October 3 at 13:30 UTC on existing project `etcaodglvcspcmwecyxq`, with at most six newly identified characters, two existing approved accounts, and their run-owned refs/grants/inventory/spells/rolls. Parent confirmed the Trello claim at 13:33 UTC. Preserve preexisting rules/data and LegendKeeper integration. No schema/migrations/RLS/security changes, new accounts, installs, extra campaign/content fixtures, remote push/merge, deployment or publication are authorized.

`hostname` confirms **Main_PC**, Windows 10.0.26200, using `exec_command` in the isolated checkout. The earlier claim that a separately named Main_PC tool was needed was incorrect. `C:/Projects/Inkborne/.env.local` already contains all seven required settings and matches the approved target. The isolated checkout lacks that ignored file. The runner reads the existing source internally, allowlists only seven setting names, respects inherited values and never copies/persists credentials. No credential values were printed or requested. Existing primary/player account identities are verified internally as distinct; no accounts were created.

## Hosted preflight

- Project moved from COMING_UP to ACTIVE_HEALTHY; auth health and both existing account logins passed. Trusted exact-ID cleanup read access passed.
- Read-only inspection covered migrations, seven effective RPC bodies/signatures/results/grants, character/content columns, RLS flags/policies and table grants. After comment/whitespace normalization, relevant hosted bodies match local `patch_character_state`, `sync_character_feature_refs`, `sync_character_spell_grants`, `set_character_background`, `set_character_asi_choice`, `search_usable_feats_for_character` and `copy_character`. This is bounded comparison, not full schema or security acceptance.
- Correction to October 2 docs: local 00031 and hosted state-patch bodies both qualify `public.characters`. Empty search_path does not cause the suspected unqualified-relation error. The SECURITY INVOKER RPC still returns void and shallow-merges JSON; denied/no-match and ambiguous outcomes remain separate risks.
- Character-child FKs inspected use ON DELETE CASCADE. `character_dm_notes` is keyed by `character_id`, unlike other inspected child tables. No character DELETE RLS policy exists; existing trusted cleanup capability was used only for the exact run-owned ID.

## Harness and local verification

See [runner instructions](../../e2e/bounded/README.md). The legacy hosted configuration remains unchanged and was not run.

- Explicit approved-project/local-origin gates; two existing distinct accounts; serial workers, no retry, installed Chrome.
- Exclusive fsynced journal reserves owner/name BEFORE a creation click. Six attempts remain the ceiling across restart/cleanup. Unknown outcomes stop further creation and cleanup; no prefix sweeps or automatic deletion hooks.
- Durable journals are in `test-results/bounded-runs/<run UUID>`; browser output is separately in `test-results/bounded-browser`. One early continuation exposed Playwright clearing the original output directory, including its journal. The three exact records had already been captured in execution evidence and were reconstructed without discovery or additional mutations. A regression now checks output clearing cannot remove persistent journals. The recovery note is retained beside the journal.
- Cleanup validates the full exact-ID scope and approved owners, rechecks owner/name, deletes with all three filters, then checks parent and all nine child tables before recording success. Ambiguous deletion stays pending. Child audit uses the actual DM-note primary key. Secondary audit errors preserve a primary journey failure; session cleanup attempts both SDK sessions and covers manifest setup failures.
- `npm run check`: strict types, zero-warning lint, **210 files / 2,019 tests passed**. Eighteen new local dry-run tests cover durable budget/ownership/gates, output clearing, exact cleanup failures, child audit, session cleanup and credential-failure page closure. No hosted calls occur in those unit tests.
- `npm run test:e2e:bounded -- --list`: two tests discovered with create-before-journey dependency. To continue an already recorded fixture without creating another, use `--project journey --no-deps`; do not assume grep suppresses dependencies.
- Application code/dependencies were unchanged, so the production build was not repeated. Prior October 2 build and 23+6 simulated Chrome results remain historical application evidence, not real acceptance of this journey.

## Real results and blocker

One real installed-Chrome test passed: local Next login, fresh character creation, builder entry and reload, plus a secondary-account update attempt that left owner readback unchanged. It initially used `127.0.0.1:3015`, which logged blocked development HMR; later runs used localhost without changing origin policy.

The same-fixture continuation selected Half-Orc and Barbarian, restored active feature refs and saved Athletics. It then encountered repeated hosted PostgreSQL **57014: canceling statement due to statement timeout**, including reference reads/refresh and a second class choice save. The complete builder-to-sheet path failed and is not accepted. The first failure was additionally obscured by a harness audit querying the nonexistent DM-note `id`; that contract mistake and error preservation are fixed locally. No hosted schema/security change or blind mutation retry was attempted to resolve the timeouts.

Four subsequent exact-fixture read-only probes all succeeded: owner character 2,408ms; owner bare refs 3,215ms; owner joined immutable snapshots 1,791ms; trusted joined snapshots 1,330ms. They did not establish a root cause or reproduce the timeout. Do not claim an RLS defect or a restored-backend cold-start explanation from these timings. No matching active query remained in the scoped activity inspection. Further acceptance mutations were stopped at this blocker.

Next narrow step: inspect the actual authenticated query plans/timings and catalog/trigger costs read-only, then resume a controlled journey within the remaining original six-attempt budget only when access is reliable. Any index, RPC, RLS, schema or hosted configuration remedy requires separate approval. HP/cast/rest real Activity recovery, anonymous/owner denial variants, concurrency and response-loss scenarios remain unaccepted. Equipment atomicity and durable actions remain proposals, not implementations.

## Fixture cleanup and evidence

Run `c9e2c9a0-0440-4d10-88b3-313bef708a28` used **one of six** creation attempts. Character `b7099e42-1781-48d2-8e39-5472e61609b1` had four content refs and 23 generated class feature grants, recorded in `owned-rows.json`. Other inspected child tables were empty; no inventory/spells/rolls/campaign/content fixtures were created.

The separately reviewed cleanup plan contained only this exact ID. The explicit cleanup command revalidated owner/name, deleted that row and verified it and all nine child scopes absent. The durable journal includes a cleaned receipt. No preexisting character/content/account was deleted. No fixture residual is known from the inspected scope.

Relevant commands (credentials remain internal):

```powershell
npm run test:e2e:bounded:runner -- preflight --env-file C:\Projects\Inkborne\.env.local
npm run test:e2e:bounded:runner -- audit --env-file C:\Projects\Inkborne\.env.local --project etcaodglvcspcmwecyxq --run-id <run UUID> --manifest <exact journal path>
npm run test:e2e:bounded:runner -- cleanup-plan --env-file C:\Projects\Inkborne\.env.local --project etcaodglvcspcmwecyxq --run-id <run UUID> --manifest <exact journal path>
npm run test:e2e:bounded:runner -- cleanup --env-file C:\Projects\Inkborne\.env.local --project etcaodglvcspcmwecyxq --run-id <run UUID> --manifest <exact journal path> --confirm-cleanup-run <same UUID>
```

Ignored evidence: `test-results/bounded-runs/<run UUID>/{fixtures.jsonl,recovery-note.txt,owned-rows.json,read-diagnostics.json}`. First server PID 33808 (parent 32232), port 3015, start 13:49:14 UTC; continuation server PID 10184 (parent 34332), same worktree/port. Playwright stopped task servers; the port was verified closed. No unrelated process/worktree was changed.

Main_PC Temp logs: `inkborne-bounded-browser.txt` (one pass), `inkborne-bounded-journey.txt` (journal-path failure), `inkborne-bounded-journey-retry.txt` (hosted timeout + original audit error), `inkborne-bounded-final-reviewed-check.txt` (final local check). Read-only catalog evidence and a duplicate cleaned fixture journal are retained under task-5. No deployment/release approval is implied.
