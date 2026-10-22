# Creation-history checks and immutable calculation storage — local checkpoint

Victor requested the next checkpoint after `3be8da5`. Vercel remains the host;
M1–M6 including M5.5 remain priority, M7/creature importing remain paused and M8
follows core acceptance. No native or hosted installation, Auth flow or application
route was enabled.

## Source and review

Integration workspace:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`,
branch `codex/launch-integration-20261011`.

| Commit | Change |
| --- | --- |
| `8e113c5` (worker `f05e58e`) | New staged creation-history reader and immutable unverified calculation storage |
| `5b0da64` | Extend the integrated fixture to 62 tests: 29 prior allocation/save cases plus 33 storage/history/policy cases |
| `0ac97c3` | Wait for the existing prepared-spell test's passive provider-probe update after its UI assertion |

Worker reused `../class-dependency-resolver-worker`, branch
`codex/class-dependency-resolver-20261021`, and changed only the new SQL file.
It remains clean at its committed checkpoint, with no installed dependencies or
started service. Existing stage files, migrations, application and hosting code
are byte-unchanged. Root owns the sole heavy verification lane.

Worker/integration SQL Git blob:
`0fb7b61b301e58d34abd1c0124e0721a4558b82d`.
Independent reviewed LF SHA256:
`e3e99b77c10d131b0f9e4f231b332d521a1f2b24d2e906f90497424ee1707916`.
Integration CRLF SHA256:
`66bad548532efcbe7f44f163dc940ebcd3d7def1d0a40812468b7e73d43a6781`.
Normalized bytes match; the difference is line endings.

Independent source review and final fixture review passed. Review added the
existing-command refusal to direct INSERT as well as the producer, preventing
direct intent-only INSERT from taking a different admission order. All nine new
functions are CREATE-only, empty-search-path SECURITY INVOKER and postgres-owned;
all API/PUBLIC execution/table access is revoked. No original class-owned helper
EXECUTE, runtime membership, definer elevation or new readiness gate is assumed.

## Delivered behavior

`read_first_class_bootstrap_history_v1(uuid)` reads actual parent, origin, order,
creation command, finalized bootstrap journal and original row proofs before any
future class acceptance exists. It requires the full current untouched empty shape,
strict 11-key bootstrap receipt, exact create intent/owner/target/system/name/zero
revisions/null campaign, native preinsert identity/time, exactly one matching
finalized bootstrap journal and exactly two matching planned/consumed proofs.
Missing, extra, changed, unconsumed or asymmetric proofs refuse. Complete normalized
before rows and full raw journal/proof payloads are retained, with explicit budgets.
This checks stored correspondence; it does not authenticate an actor or establish
that manually seeded fixture history was genuinely issued.

`prepare_first_class_calculation_v1(jsonb)` accepts only the strict original finite
intent. Existing class-command identity first refuses with
`existing_command_requires_authenticated_recovery`; it never returns a receipt
without Auth. Otherwise exact same-xid/target/intent calls return the original
record, and changed intent refuses. A prior transaction's record cannot satisfy
that lookup. A new transaction checks history/sources and derives a fresh record.
Same-xid retrieval is original historical evidence, not current-owner/permission/
source revalidation.

The table's BEFORE INSERT guard rejects any supplied nonnull protected field.
It derives history, calls the existing native allocator, rechecks actual history
and before rows, and stamps native calculation UUID/xid/time and subject identities.
Direct intent-only INSERT follows the same guard. Full history and exact envelope
are immutable; record kind is always `unverified_preacceptance_calculation`.
History/envelope/whole-record bounds are8/8/16MiB; request is32KiB. Row UPDATE/DELETE
and statement TRUNCATE refuse even for the ordinary owner path. Trusted owner DDL
can still alter/drop objects; these guards are not a boundary against that owner.

FORCE RLS uses an explicit postgres-only owner policy with no runtime grants.
Policy membership and protected storage are not verified Auth. The table has no
FK to a live character, historical journal or future acceptance: it adds no old
lifecycle constraint or circular planning dependency. This means stale-record,
retention/deletion and lifecycle policy must be accepted before native installation.
These records must never be relabeled/adopted as verified B1 plans; future planning
must independently derive a new typed record after real Auth, locks, content and
all-writer closure. Actual B2/B3 consumers remain absent and unchanged.

## Verification and preserved failures

Scratch evidence root:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime\evidence`.

- `local-class-allocation-20261022T131159Z`:56/57 passed. One synthetic corruption
  setup tried to violate the original bootstrap CHECK before reaching the reader.
  The test now verifies that existing constraint's refusal instead of weakening it.
- `local-class-allocation-20261022T131232Z`:57/57 passed.
- `local-class-allocation-20261022T131336Z`:61/62 passed. The extra policy probe
  could not demote PGlite's protected default postgres role.
- `local-class-allocation-20261022T131410Z`:61/62 passed. Metadata confirmed default
  postgres is SUPERUSER/BYPASSRLS with RLS inactive; that path cannot prove policy
  enforcement. Both failures were preserved and source SQL was unchanged.
- `local-class-allocation-20261022T131525Z`:**62/62 passed**. A different, synthetic
  inherited-owner-role probe exercised the unchanged policy with active RLS.
  All six observed process identities from each focused run exited.
- First full check `local-check-20261022T131555Z`: typecheck/lint passed;4981 tests
  passed, one existing prepared-spell provider assertion failed, three M5 skips.
  All 428 observed identities exited. The UI already reflected prepared state;
  the module-level probe is published by a later passive useEffect. Independent
  diagnosis approved awaiting the probe assertion with the existing waitFor.
  Product behavior and timeout limits were unchanged.
- The original subclass provider file passed 19/19 in isolation before the fix
  (`local-subclass-casting-20261022T132145Z`) and 19/19 afterward
  (`local-subclass-casting-20261022T132209Z`); all six observed identities exited
  in each run. The original full-suite failure is preserved.
- Final full `npm.cmd run check` at executable source `0ac97c3`, evidence
  `local-check-20261022T132217Z`: **PASS** typecheck, zero-warning lint,
  **363 files / 4982 passed / three UNVERIFIED M5 skips**, four bounded workers.
  Finished 13:26:21.1068541 UTC; all 435 observed process identities exited. The
  three skips remain open requirements, not waived/accepted behavior.
  Independent post-run identity/resource readback is beside the gate's summary.
  Only documentation changed afterward; no further full gate was needed.

The final policy probe creates a transaction-local fixture role, grants inherited
postgres object/policy membership, and sets it as current role. Literal current
role, SUPERUSER=false, BYPASSRLS=false and row_security_active=true are asserted
before native prepare/SELECT. The transaction rollback removes the fixture role/
membership. No production/native role, source owner or policy definition changed.
This is synthetic inherited-owner policy execution, not actual native postgres or
isolated runtime-role permission acceptance.

API-role actual calls are denied, alongside explicit table/function ACL assertions.
The actual denial may occur at schema usage before the function layer; no narrower
failure layer is claimed. Original denied Auth functions, false class gate and all
13 readiness families remain unavailable in the fixture. Positive storage compares
all rows in14 named original graph/history tables and the complete resulting new
record. Refusal comparisons run after savepoint rollback and establish fixture
recovery, not production failure-phase atomicity.

The cross-commit test uses a separate cloned in-memory database, closes it in
finally, and leaves the main rollback fixture untouched. It commits one calculation;
a new transaction with a removed dependency fails rather than adopting the old
record. After rollback, a fresh transaction creates new IDs/xid while the first
record remains calculation-only. This is offline commit behavior, not native
durability/recovery, multi-connection races or hosted persistence.

Historical receipts/journals/proofs were manually seeded against original DDL.
Original production admission/proof/materializer triggers and full RLS/FKs are not
installed for those fixture tables. New calculation triggers/policy run unchanged.
No Auth replacement, successful bootstrap issuer, accepted journal or actual
character choices save is inferred. No development server, browser workflow or
fresh build was needed; no native/hosted/provider/push/merge/deployment action ran.

Before/after listener counts stayed 44. Free memory before the check lane was
7,839,912 KiB; final resource aggregates are recorded in the independent readback.
These include shared unrelated machine activity; no continuous sampling, CPU or
per-process memory attribution is claimed. No task-owned background service was
started. The isolated in-memory clone was closed by its finally block.

## Remaining work

Verified B1 planning still needs real native Auth/context/current-owner checks,
genuine bootstrap issuance and all required source/writer locks/fences. Selected
row snapshots alone do not prevent candidate phantoms. A verified producer must
derive a separate immutable plan before acceptance, without adopting these
unverified rows or creating a postacceptance input cycle. B2 must consume exact
planned identities through original materializers; B3 must perform the actual
guarded choices UPDATE, typed OLD/RETURNING proof, complete order binding and
single-use receipt finalization. Native installation/security/race, browser/
provider and hosted release acceptance remain open. Vercel and the M7 pause remain.
