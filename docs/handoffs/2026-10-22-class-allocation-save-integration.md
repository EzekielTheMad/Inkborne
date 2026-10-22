# Native class allocation and saving-throw inputs — local checkpoint

Victor authorized the next allocation and save-integration work while retaining
Vercel hosting, M1–M6 priority and the M7 pause. This follows the tested dependency
checkpoint `904342b`. M5.5 remains in core scope; M8 follows accepted core work.
No hosted action, native SQL profile, application route or gameplay gate was enabled.

## Delivered source

Integration workspace: `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`,
branch `codex/launch-integration-20261011`. The older C:\Projects\Inkborne backup
and unrelated worktrees were preserved. Bounded delegation follows the original
ZIP kickoff; root owns integration and the sole heavy verification lane.

| Commit | Delivered behavior |
| --- | --- |
| `743a4b3` (worker `9d24f87`) | New staged native first-class allocation calculator |
| `0a91a3d` | Native-graph advisory save adapter and 29 integrated allocation/compatibility tests |

The SQL worker used its retained isolated `../class-dependency-resolver-worker`
checkout, branch `codex/class-dependency-resolver-20261021`, without starting any
service or installing dependencies. It remains clean at its committed checkpoint.
SQL Git blob `084b6ddec9ae5142370ba3c4c4c50d84d65b167f` matches the reviewed worker.
Reviewed LF SHA256:
`34443600428a25412c8f3ad2b7505d53347c50ea479f15b8998cda1fdc86de2f`.
Integration CRLF working-file SHA256:
`c8d4da99a568879899106c74369a96aeb96f188fb7c1f67c062236260c711ca1`.
This is a line-ending difference, not a different implementation.

The calculator is CREATE-only, atomically owned/revoked, VOLATILE SECURITY INVOKER,
empty search_path and postgres-owned. No runtime EXECUTE grant or caller is added.
Existing class-owned helpers are not assumed executable by the actual non-superuser
postgres; request key/receipt checks use builtins instead of introducing new grants.
Actual installed default ACL/owner/invoker privilege validation remains future work.

## Allocation and save-evidence behavior

The strict add_class intent accepts no caller actor, allocated native row IDs,
timestamps, graph or allocation map. Character/operation/content identifiers remain
the request's inputs. The finite profile requires canonical lowercase supported UUIDs,
zero expected revisions, exact class tuple and subclass:null. Actual parent/header/
order rows must structurally match untouched new-character/null-campaign/draft/
revision-zero data; actual occurrences/refs/inventory/spells/grants must be empty.
The original name/color/other fields are preserved. This does not establish genuine
bootstrap history, native verified Auth or stabilized acquisition permission.

The native allocator derives every ID from gen_random_uuid and the entire raw graph
from typed rows plus the exact dependency resolver. It includes dormant grants,
active feature refs and auto spells, with allocated grant links and source order.
All projection created_at fields use transaction_timestamp, matching legacy now().
Occurrence selected_at and proposed receipt accepted_at share one clock instant;
raw native JSON timestamps and canonical receipt formatting remain distinct.

Proposed parent choices contain one {occurrence_id,slug,level:1}, with no subclass
property; parent shared revision and header command revision become string1. The
origin remains draft and unconfirmed. The graph contains ten exact top-level
domains; order arrays bind the allocated IDs, and exact raw versions sort by native
UUID then integer version as in the original reader. The native row envelope is
separate from the three private transition proposals: origin update, occurrence
insert and class_receipt insert. The receipt's verified_actor_id is the actual row
owner copied for compatibility, not an authenticated claim.

The pure advisory adapter connects native graph data to collectClassRoleEffects.
It checks canonical revision values, target/order/version closure, controller and
grant/projection tuple links; subclasses are explicitly outside its finite profile.
It deliberately projects native controller fields out of the strict advisory
occurrence DTO after validating them. Raw source effects/data/order remain intact.
System/proficiency and any existing advisory manifests remain explicit inputs;
no compiler manifest, independent-save classification or confirmation is invented.
Absent manifests keep affected saves unavailable; a matching manifest still cannot
confirm a draft. Legacy save_* effect names are preserved and remain unavailable.
Neither new module is connected to an application save/read path.

## Independent review

Read-only semantic discovery identified exact row/default/order/receipt contracts.
Independent source review passed the final SQL and adapter. Before the first test,
review fixed request/stored UUID compatibility with installed Zod, inaccessible
class-helper dependencies, and a receipt key count of13 instead of12. Adapter
review added canonical revisions, explicit subclass refusal and native grant links.
No acceptance, Auth, readiness, proof-policy, existing materializer or migration
was changed as part of those fixes.

Independent fixture review passed. It validates complete raw-row compatibility
without weakening production guards. The fixture executes the original final graph
reader, original guard function/table and strict original SQL/TypeScript receipt/
graph/transition validators. Controlled manual row insertion, revision changes and
order replacement are disclosed; they are not an actual save or B2 execution.

## Verification

Evidence root:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence`.

- First focused run `local-class-allocation-20261022T003801Z`: 27/27 passed;
  all eight observed process identities exited.
- Expanded run `local-class-allocation-20261022T003836Z`: 28/29 passed. One new
  test accidentally passed undefined through a helper that defaulted it to[];
  this was a fixture expectation error, not changed production behavior. Preserved
  failure; all six observed identities exited.
- Corrected focused run `local-class-allocation-20261022T003851Z`: **29/29 passed**;
  all six observed identities exited.
- Full `npm.cmd run check` at executable source `0a91a3d`, evidence
  `local-check-20261022T003900Z`: **PASS** typecheck, zero-warning lint,
  **363 files / 4949 passed / three UNVERIFIED M5 skips**, four bounded workers.
  Finished 00:43:54.6338484 UTC; all 380 observed process identities exited.
  Independent post-run identity/resource readback is beside that gate's summary.
  The three skips remain open requirements, not waived or accepted behavior.
  Only documentation changed afterward; no repeat full gate was needed.

The tests prove exact expected_graph equality against the unchanged final reader
after inserting proposed full rows, full original receipt/transition shape
compatibility, native UUID/time/default/reference bindings, dormant/version order,
provisional saves, missing-manifest behavior, legacy raw effect preservation and
meaningful malformed/order/tuple/foreign/grant-link refusals. Positive nonmutation
compares every row in ten named graph/source tables. It does not include command,
guard, share/membership or every production table. Refusal comparisons run after
savepoint rollback and establish fixture recovery only.

This is single-connection PostgreSQL-WASM with reduced FKs and no production RLS,
Auth, materializer/revision/other production triggers or concurrent sessions.
Manual parent/revision/order writes do not establish ordinary OLD+1 behavior,
protected materialization or provenance. Model metadata/ACL assertions are not
native installation permission acceptance. No server/browser workflow changed,
so no E2E run or fresh application build is claimed. No task-owned service remains.

Before/after observed TCP listeners stayed 44; free memory before the check lane
was 8,695,672 KiB and post-run 9,202,340 KiB. Post-run process count was 516. These
include unrelated shared machine activity; no per-process memory attribution or
continuous resource sampling is claimed. No development server was started;
listener counts were compared only before and after the checks.

## Remaining class work

Protected B1 still needs a distinct preacceptance reader binding genuine bootstrap,
verified actor/context, owned locked parent/header/order and stable content to an
immutable native plan. The existing class_first_acquisition_inputs_v1 requires an
already accepted graph and cannot calculate that graph without a dependency cycle.
The calculated envelope is not protected storage or a locked source certificate;
never retrospectively upgrade it into provenance or patch an accepted graph/ID map.

B2 must consume exactly those IDs through all affected original materializer/ref/
spell paths and retain ordinary behavior elsewhere. B3 must perform the guarded
actual choices UPDATE, retain typed OLD/RETURNING correspondence, bind complete
domain order, observe proof, consume once and finalize receipt in one transaction.
Existing independent Auth/input/proof refusals remain. Native fixture/race,
provider/browser, hosted and release acceptance remain open. No push, merge,
deployment, credential, hosted write or backup/restore action occurred.
