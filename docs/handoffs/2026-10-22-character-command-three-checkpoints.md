# Character command native verification — three preparation checkpoints

Victor requested the next three checkpoints toward authenticated character saving.
These complete the previously identified SQL pack, concurrency runner and frozen
launch-package preparation. They do not execute or accept a native profile.
Vercel hosting is unchanged; M1–M6/M5.5 continue, M7/creature imports stay paused,
and M8 follows accepted core work.

Integration workspace:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`,
branch `codex/launch-integration-20261011`, turn base `5736d7f`.
Root used the sole verification lane. The isolated SQL worker remains clean on
`codex/character-command-native-package-20261022` at `435c2ef`; prior branches and
other worktrees are preserved. Independent source, fixture and launch-controller
review passed. No service, browser, container or native SQL was started this turn.

## Checkpoint 1 — metadata and exact synthetic fixtures

`ecf9de5` / `75818b2` integrate the five SQL files under
`scripts/character-command-verification`; `0302ec9` adds offline SQL tests.
`33a1a16` adds installed-function metadata characterization and `96e1197` types
the fixture count helper after the first repository typecheck failure.

- `catalog.sql` captures bounded selected relation/column/key/owner/RLS metadata,
  effective roles/membership/privileges, trigger bindings and function fingerprints.
  It returns no Auth/application row contents or function bodies. Metadata above
  the finite limits refuses instead of truncating; output is limited to 1 MiB.
- `preflight.sql` requires the actual native postgres profile (NONSUPERUSER,
  BYPASSRLS), exact selected types/PK/FKs, original signup trigger, selected-column
  SELECT plus locking rights, inactive RLS for that actor, and an absent guard.
  Missing rights or schema drift stop; no repairs or grants are performed.
- `guard-fixture.sql` contains exactly the original guard CREATE TABLE statement
  and singleton INSERT. It installs no authority stage, runtime role, policy,
  grant, readiness record or operational writer fence.
- `seed.sql` reserves seven UUIDs across all five fixture relations, creates one
  synthetic draft game system, two users, two sessions and two characters. Only
  the original signup trigger creates profiles; its output is checked. The fresh
  83-migration baseline has no game-system row, so a real D&D system is not assumed.
- `fixture-cleanup.sql` validates exact markers and relationships, locks roots,
  scans bounded incoming FK references and refuses foreign/unknown references or
  unsupported composite edges before deleting the exact owned rows/system.
  Unrelated roots remain. Guard/functions disappear with the owned volume.

Reserved UUIDs are `10000000-0000-4000-8000-000000000001` through `...000007`:
actor, session, target, second actor, system, second session, second character.
The system slug is `inkborne-authrows-fixture`; it is synthetic draft data with
empty mechanics. Users have nonsensitive fixture markers, no passwords, tokens
or login. No SRD/import/content provider is invoked.

The 12 offline PGlite tests use reduced typed Auth/character tables and unchanged
original profiles/game-systems migrations. Native preflight deliberately refuses
PGlite's SUPERUSER postgres. A separate explicit fixture installation executes the
unchanged staged functions and real catalog SQL, confirming signatures, returns,
empty search paths, body MD5 and role-execution JSON expected by the wrapper.
This is deterministic metadata/fixture evidence, not native privilege/RLS proof.

## Checkpoint 2 — three-session runner and persistent transport

`44a32fa` adds `scripts/character-command-concurrency.ts`,
`scripts/character-command-psql.ts` and their tests. `33a1a16` tightens idle output
handling. The runner implements exactly eight scenarios:

| Scenario | Required native observation when separately authorized |
| --- | --- |
| Checker first, then session delete | Exact delete backend waits on checker; completes after checker commits |
| Delete first | Checker blocks, then refuses after committed deletion |
| Ban first | Checker blocks, then refuses after committed future ban |
| Owner transfer first | Checker blocks, then refuses current-owner mismatch |
| JWT expires on guard wait | Edge observed before expiry and still blocked after native deadline; P0001 after release |
| not_after expires on session wait | Same before/after native-time proof, then P0001 |
| Statement failure/rollback | Real 22012 failure, rollback, waiting delete completes |
| API caller roles | SET LOCAL ROLE succeeds; row-check invocation itself returns 42501 for all three roles |

The observer checks exact backend IDs, application names, active Lock waits and
`pg_blocking_pids` edges. Sleeps alone are never contention evidence. Scenarios
are bounded to 15 seconds by default and a total 1,024 queries. Sessions close on
success/failure; failures stop further fixture work. The caller must attest that
injected sessions are real PostgreSQL; scripted tests cannot do that.

The unused persistent transport starts only an identified `docker exec -i psql`
against a verified owned runtime, with no credentials or startup. Every frame is
one top-level statement; a later success cannot hide an earlier SQLSTATE. Fixed
SELECTs return JSON rows. Random markers, strict SQLSTATE/JSON parsing, no
backslashes/multiple statements, byte limits, query/close deadlines and exact
process records fail closed. Raw server stderr is counted, not stored. Forced or
nonzero child exit and evidence-write failure cannot count as clean closure.
Native wrapper separately checks all captured PostgreSQL backend PIDs absent.

All 40 runner/transport tests use SIMULATED sessions or fake child streams. No
Docker/psql process, lock race or native clock was exercised by those tests.

## Checkpoint 3 — frozen package and separately authorized controller

`33a1a16` adds `scripts/character-command-native.ts` and 16 SIMULATED
freeze/admission tests. They cover temporary Git source inventories, mocked
external bytes, exact new-scope approval, drift and early refusal. They do not
exercise a successful `executeCharacterRows` orchestration path.

The freezer requires a clean committed HEAD and binds all 83 migrations, the old
baseline recipe/inventory, all nine new executable/SQL inputs, seven fixture IDs,
six permitted operations, both exact official external bootstrap files and the
standalone external controller. Raw file SHA256 binds source; LF normalization
for SQL transport and expected function-body MD5 is deliberate and consistent.

External controller:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\character-command-run.mjs`.
Its independently reviewed SHA256 is
`45bba01eccc3d799eecfb2aa01b8ffd580897f67394532cb053a63a9067fb616`.
It passed `node --check`; it has never been executed. It is a standalone narrow
copy of the successful G2 startup/teardown recipe, not a dependency on a generator.

Before resources, it requires a fresh `character-command-rows-native-v1` human
record, exact source/package/engine/operation confirmation and unchanged bytes.
Old G1 or baseline-only G2 records refuse. The old baseline API's scope is used
only internally for `phase: baseline`, after the new scope is admitted; the
controller records both scopes and never invokes its gameplay-stage path.

The future run has three existing digest-pinned images, three containers, one
internal network, two volumes, five reviewed database mounts, no published ports,
no pulls and no Auth HTTP service. Database/job memory limits are 1 GiB/256 MiB/
512 MiB; CPU limits 1/0.5/1 and PID limits 256/128/128. Startup rechecks 20 GiB
free disk and 3 GiB free host memory, exact RepoDigests and separately inspected
image IDs. It will refuse a stopped/mismatched engine rather than start it.

It replays official migration jobs and the 83-app-migration baseline, captures
metadata, preflights, installs only guard fixture/new closed functions, seeds,
opens three native sessions, runs the eight cases and checks backend absence
before exact fixture cleanup. New non-teardown commands refuse after 15 minutes;
an in-flight command retains its own timeout and teardown runs separately.
Finally it removes only recorded, identity-checked owned
resources, reads those resources and recorded client PIDs back absent, and retains
the shared Docker engine/cache. Attempts use exclusive unique evidence directories;
failures are preserved. PID reuse causes conservative refusal, never a process kill.

The final freeze is written after the documentation commit, without changing repo
source afterward, under external `equipment-runtime\evidence\character-rows-preparation-20261022-checkpoint3`.
`package.json` is the freezer's exact JSON; `preparation.json` binds its hash and
the exact future `node --import tsx` controller invocation. No approval JSON is
created. The approval path in that invocation is reserved for a later genuine
human record; this handoff supplies no run permission.

## Verification and preserved failures

Evidence root:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence`.
The test and project-check runs used existing npm scripts; root ran one test lane
at a time.

| Evidence directory | Observed result |
| --- | --- |
| `local-character-pack-20261022T153451Z` | Recorder sharing violation; no test result claimed. All three observed identities later absent; original directory preserved |
| `local-character-pack-20261022T153542Z` | 9/11 passed; actual catalog SQL rejected qualified multi-array unnest (42883). Corrected using native array subscripts, preserving full FK pairs |
| `local-character-pack-20261022T153724Z` | 11/11 passed after SQL correction |
| `local-character-runner-20261022T153615Z` | 39/39 passed |
| `local-character-native-20261022T154108Z` | 16/16 freeze/admission cases passed; all 11 observed identities exited |
| `local-character-runner-20261022T154138Z` | 40/40 after idle-output regression; all seven observed identities exited |
| `local-character-pack-20261022T154504Z` | 12/12 including real offline catalog/function metadata; all six observed identities exited |
| `local-check-20261022T154520Z` | First full check stopped at six unknown-result TypeScript errors in the fixture count helper; all seven observed identities exited. Added a typed result, without changing SQL/assertions |
| `local-check-20261022T154540Z` | At `96e1197`, full `npm.cmd run check` PASS: typecheck, zero-warning lint, 370 files / 5,187 passes / three existing UNVERIFIED M5 skips; all 528 observed identities exited |

The scratch evidence recorder now retries bounded transient file sharing failures;
no product source, SQL predicate or test expectation was weakened for that failure.
Full gate finished 15:49:46.8606674 UTC, four bounded workers. The three skips remain
open requirements. Only documentation changed after the tested executable source.

Independent final readback at 15:50:11.1878575 UTC found every recorded identity
absent across all nine attempts (580 per-attempt observations, not necessarily
unique PIDs), with no matching workspace test/server process. Before/final shared
machine snapshots show 549/545 processes, 6,656,328/6,906,668 KiB free memory,
22/22 percent CPU and 44/44 TCP listeners. These are point observations, not
continuous monitoring or per-process attribution. `before.json` and
`final-process-readback.json` are beside the full gate's process journal/summary.
No task-owned background service needs to remain running.

No application/browser workflow changed, so E2E/build were not run. No native
profile, provider flow, hosted SQL/configuration/credential change, push, merge,
deployment or Vercel change ran. Original Auth refusals and save gates remain.

## Remaining acceptance

The eight cases do not close the broader proposed matrix. Native soft-delete,
checker-first user updates/ownership transfer, missing profile/guard/session and
wrong session owner, expiry at every relevant row wait, direct clock-helper role
denials and complete before/after row equality remain outside this first runner.
The existing reduced-schema SQL tests do not replace those native requirements.

The next executable boundary is the separately authorized finite native profile.
A successful result would establish only its captured metadata/capabilities and
selected SQL contention outcomes. Provider HTTP refresh/logout/password/ban/delete,
effective timeout/low-AAL/single-user settings, provider/RI lock-order behavior,
real same-token integration and acceptance-time save expiry remain open. Both
original `require_*_auth_v1` functions still always deny. Authenticated saving is
disabled; genuine bootstrap, verified B1 planning, B2 materializers and B3 guarded
choices writing/recovery remain required. See the [updated finite plan](../specs/2026-10-22-character-command-native-row-check-plan.md).
