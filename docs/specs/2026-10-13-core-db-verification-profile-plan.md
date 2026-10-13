# M1/core G2 verification profiles — additive preparation plan

2026-10-13, PLAN ONLY. Sole docs writer in r12-passive-feature-worker on clean
0517fdeecb91b879940a1a44c665143dd516611a. Reference root source:
881dfc9d96ed22b86170fb7cdde73bfa53a934e9; docs-only successor:
9a2870c25c2beb32f7c76ea9bce70122d7a7bd60. The latter changes only CURRENT-STATE
and LAUNCH-ACCEPTANCE. Read-only root checkout checks before/after hashing both
returned9a2870c and clean status. Latest combined acceptance still belongs to81629ce,
not these later P1 source integrations. No new source acceptance, execution or
permission is inferred from this plan or the M1–M6 priority; M7/import work is paused.
During drafting root reported a later clean Magic integration b8f1d44; that is not
an executed profile or renewed combined acceptance. This document freezes discovery
at9a; a future executable freeze binds the then-selected reviewed current candidate.

## Two distinct boundaries, one preserved predecessor

Original R07.1 freezes full migrations plus ONLY
`supabase/staged/starting-equipment-transaction.sql`, Compose, its helper and
bootstrap/baseline/stage/catalog SQL. R07.2 separately freezes canonical equipment
fixtures and preserves the original manifest/approval/baseline/stage receipts.
Neither helper freezes or applies the five disabled R09/P1 stages below. A current
application SHA in an old equipment receipt cannot establish their acceptance.

Keep original R07.1/R07.2 source, formats, fixture budgets and immutable receipts.
Propose NEW additive profile `core-db-disabled-install-v1` ONLY after separately
authorized equipment baseline/stage/fixture execution and confirmed cleanup.
No rewriting old manifests, impossible old/new SHA equality, in-place profile
promotion or re-running the old fixture helper after its catalog has changed.

- Equipment profile: actual PostgreSQL migration/trigger/role/award/consume/replay/
  version-drift/copy slice under its original reviewed scenario/IDs. Real native
  execution is still pending; role claims do not verify HTTP/JWT/Auth providers.
  Its concurrency, fault and committed-response-loss expansions remain separate.
- New disabled profile: source installation, ownership/effective ACL/RLS/constraints/
  trigger metadata and exact denial behavior. NO positive native Auth, originating
  history/bootstrap/add-class/confirmation/roll command acceptance, writer cutover
  or gameplay availability while Auth and readiness are unavailable.

## Exact source inventory and byte identity

There are83 ordered migrations, `00001_profiles.sql` through
`20261010232200_save_character_abilities.sql`; Git comparison against72fb420 found
ZERO migration or starting-equipment changes. Every individual path/hash remains
mandatory in the future emitted manifest; this prose is not its replacement.

Read-only root9a2870c Windows-byte SHA256 values below. Git blob IDs bind source
identity separately. Line endings vary across checkouts: do NOT normalize approved
SQL bytes or treat Git-LF hash as a substitute for the actual manifest bytes.
Any future different bytes require an explicitly new freeze/profile review, even
when the Git blob is unchanged. Each complete source file executes as its existing
BEGIN/COMMIT unit; no extract/reorder/splice within a source transaction.
Tables display uppercase hex; a future canonical manifest emits lowercase SHA256
hex over the same bytes and preserves original receipt serialization unchanged.

| Order / file | Root worktree SHA256 | Git blob |
| --- | --- | --- |
| E — `supabase/staged/starting-equipment-transaction.sql` | `095F4B351DC39A73433657602E8FC4D8879C25993E28D213DBDE7DF6EA76BA4C` | `c348594994ec14b50afbeffca03a1e3688094952` |
| D1 — `supabase/staged/hit-die-transaction.sql` | `421A4A07FA9B906902B15CDD65FDE0B6DF3379AC7A26289323BDBA0D34511075` | `5d9fc835b0b8b957ca88e8fedf2ff6cc4b752faf` |
| D2 — `supabase/staged/hit-die-authority-and-writers.sql` | `22CE70D16FB1E9B0901104C52AF93B874E0529D9C469473D1ADBD4C20F5BD678` | `7f8650efc96617063cf03e6ea4c5763f684ce72c` |
| D3 — `supabase/staged/class-origin-producer.sql` | `6E63FAE70DEF885AD61E42CE19E432FA3CD40AF087F4334CEFA7927B37D5FF49` | `3e39a6c96e638aea87e39ee9fbd34f915a20758d` |
| D4 — `supabase/staged/class-origin-joint-revision.sql` | `44405CAFA718417E37764A21B5478CD88B3B0185E7946FBA2649061A7EAFD227` | `d07ce2f53b0af06950ae3eb46006906e804701ed` |
| D5 — `supabase/staged/class-origin-confirmation-producer.sql` | `8749A25D7D166457FCB855AF4631D0A7F1B9D7A6AA0392ECBAF2FFA4C6EE45F4` | `7d0d7db1d3988e94de5143b84e7f3c89b8cb3176` |

Adjacent frozen dependencies at9a2870c:

| File | Actual root byte SHA256 |
| --- | --- |
| `docs/specs/2026-10-12-equipment-runtime.compose.yaml` | `0AD22C154BB12E7C4486DE030B0D3A0A5C02BE2C25CB36A160BBE243159FE721` |
| `scripts/equipment-runtime.ts` | `D20C9A899EC31927A623776F2BFBA23ADE9BBDD0DEE30050B5F193EA0C9F2C0F` |
| `scripts/equipment-runtime-fixtures.ts` | `2A791E55EED7072525742B025BC7DD8AB32F44D5F909908BF230D3D0000CB7CA` |

Diagnostic migration-inventory digest:
`09E6FE2A1BC98BED001E7E791278C8FB3E0B455596427F93D01F512280893FC4`.
Its exact serialization was UTF-8 PowerShell ConvertTo-Json -Compress of the83
Git-path-ordered `{path,sha256}` rows, uppercase digests, no final newline. It is
an observation aid only; the executable new manifest freezes individual bytes
and canonical versioned JSON serialization, not dependence on that shell format.
Original official role-bootstrap bytes still require their separately selected
source/hash `3ad717b225daa38aa982da26750f35641eb404e1eb5e69a763c22236ab96c1b2`.
No bootstrap content was fetched/copied or executed during this plan.

## Exact stage/object/owner dependencies

| Stage | Requires / creates or replaces | Owner / mandatory acceptance boundary |
| --- | --- | --- |
| E | Full83 migration chain, real Auth/Storage bootstrap; equipment ledger/provenance, restricted create/resolve/commit, latest copy function and ref/ledger guards | Original R07 effective service-role/owner/foreign/anonymous matrix; unchanged source. Finish R07 fixtures/cleanup before D1. |
| D1 kernel | Existing public characters/rolls/private schema. Adds action_revision, `hit_die_gate_v1`, action receipts, linked-roll identity and mutually deferred FKs; native-time/intent helpers and always-unavailable dependencies; three original public hit-die RPCs | `inkborne_hit_die_kernel_owner` NOLOGIN/NOBYPASSRLS/NOINHERIT, no runtime CREATE/membership. Gatefalse/receipts0. D2 later revokes all three original service-role EXECUTEs. |
| D2 authority | D1 helpers/revision column. Adds singleton `character_writer_guard_v1`,13 readiness rows, projection order; verified-Auth stub, graph/dependency-v2 reader, revision BEFORE trigger/order-rebind AFTER trigger, public graph/inspiration wrappers | `inkborne_hit_die_authority_owner`, same closed attributes. Auth unconditionally raises auth_unavailable; ALL13false/order0. Only two new public wrappers receive service-role EXECUTE. Graph metadata is not writer readiness or source authority. |
| D3 P1a | Actual D2 guard/order/revision and version/parent tables. Adds class gate/header/occurrences/manifests/creation+class receipt journals/acceptance+row proofs; immediate row guards, normal/bootstrap finalizer dispatch and two initially-deferred closures | `inkborne_class_origin_owner`, same closed attributes. Classgatefalse/private evidence tables0. Private begin/Auth always unavailable; no compiler/producer/readiness issuer or caller EXECUTE. Table owners are audited separately from runtime function owners. |
| D4 joint | BOTH unchanged D2 and D3 functions/owner families. Adds revision-event table/policies, class delta/observed/assert/consume, authority apply/guards, class AFTER dispatch; replaces actual P1a acceptance/normal-finalizer and R09 revision objects under their original owners | Stage order is table/policies→new dependencies→replacements→new triggers→ACL closure. Existing P1a deferred closure remains; event callback calls only new class assertion. No EXECUTE expansion to base finalizer or journal DML grant to authority. Event0/Auth unavailable/13false/bootstrap0 unchanged. |
| D5 confirmation | D4 joint and retained D3 evidence. Five authority UPDATE(id) child lock grants with paired restrictive WITH CHECK(false) policies; class private-input helper→authority source helper→class before validator→private already-first entry | Exact helper bridges only: class private-input EXECUTE to authority; authority source-helper EXECUTE to class. No caller/entry grant, old begin replacement or shared source edit. Receipts SELECT/INSERT only; immutable bytes + finalized journal/consumed-proof locks. Auth still ALWAYS denies, no genuine bootstrap/add-class history currently exists. |

After each stage record exact effective owners/ACLs, policies, function definition
hashes/search_path/security flags, runtime role memberships/CREATE rights and real
constraint/trigger definitions/deferral flags. Source MD5 metadata supplements the
source SHA256; neither is behavioral proof. Runtime NOLOGIN/NOBYPASS roles do not
make postgres administrative calls represent authenticated users. Service_role
may bypass RLS; column/table/EXECUTE checks are separate from RLS filtering.

## Proposed additive manifest, approval and phase protocol

NEW `scripts/core-db-verification.ts`, builtin transport composition only; NEW
SQL assertion files, focused injected/static tests and handoff. Reuse exported
R07 target verifier, psql builder/audit and process readback. Do not rewrite the
original R07 helpers/stages, formats, approval records, fixture modules or receipts.
If exported interfaces prove insufficient, stop for a separately reviewed minimal
interface amendment rather than bypassing target/hash or lineage checks.

Proposed manifest contract_version1:

- Scope `core-db-disabled-install-v1`, clean FINAL sourceSha, complete ordered
  migrations with individual SHA256/Git identities; original E/R07/Compose/
  bootstrap/assertion/fixture hashes; new runner/assertion executable hashes.
- Immutable predecessor hashes/paths: ORIGINAL R07.1 manifest+human approval+
  baseline+equipment stage receipts; ORIGINAL R07.2 manifest+human approval+
  fixture-complete+cleanup receipts, exact source SHAs and all target IDs.
  Require confirmed cleanup, same exact target and unchanged protected source
  bytes/catalog lineage. No predecessor currently exists in a real runtime.
- Ordered D1–D5 paths/bytes/owner expectations and per-stage selected catalog/
  exact counts; independent-family review identities; explicit expected denials
  and zero fixture-write budget; future profiles are absent by default.
- Exact daemon/container/image/network/volume IDs and selected image platform,
  Compose/bootstrap/mount inventory, no ports, time/output/evidence/resource caps.
- New manifest/profile hash distinct from all predecessor hashes. A docs-only
  later source freeze does not rewrite historical SHAs. Drift rejects before SQL.

Runtime approval is a separate EXISTING record of actual human authorization:
gateG2, approvedByVictor, actualUTC, exact scope/source/profile hash and target IDs,
operations exactly `["install-disabled-stages","verify-disabled-stages"]`.
Original R07 approvals do NOT authorize this profile. Overall runtime ownership/
teardown remains a separately explicit G2 operation/resource list; writing JSON
cannot create authority. No approval artifact or generated credential is created
by this preparation task or by a future freeze-only command.

Finite proposed sequence after all real approvals:

1. Original supported bootstrap,83 migrations, E, R07.2 fixture phases and confirmed
   exact-ID cleanup under their ORIGINAL receipts/authority. Retain post-E,
   pre-fixture baseline and cleanup audit unchanged. Do not credit their outcomes
   until actual PostgreSQL execution/readback has occurred.
2. New freeze binds that confirmed predecessor and current clean reviewed source.
   Reverify exact isolated target/mounts and selected catalog+exact table counts
   equal predecessor cleanup. Refuse existing disabled objects/roles, partial
   installations, foreign target, missing original receipts or re-used journal.
3. Install D1–D5 sequentially, each complete approved byte buffer ONCE, as original
   administrative deployment role postgres; no rewriting Auth/readiness/helpers,
   substituting stubs, source concatenation or skipped guard/ACL statements.
   Stage transaction commits before its bounded readback and journal write.
4. Audit/default-denial slice after each install. Final graph: kernel gate1false,
   authority guard1/readiness13false/order0, class gate1false; all new receipt/
   header/occurrence/manifest/journal/proof/event tables0. No class/durable fixtures
   or command writes, no gate flip, no role grants outside exact source. Compare
   unrelated row counts and existing equipment evidence/entrypoints; explicit
   D4 replacements/D5 lock-only policy deltas are the ONLY permitted new catalog
   differences. Do not rerun old R07 fixtures against this changed catalog.
5. Store finite installed/default-denial receipt with honest remaining boundaries;
   read back all new gates/counters/counts/ACLs and exact resources. Overall G2
   owner handles explicitly approved exact-ID runtime teardown after evidence.
   No automatic data cleanup/down-DDL/retry/resume path or container-name delete.

First SQL failure, timeout/deadlock, transport loss, commit/journal uncertainty,
catalog/count/identity drift or unexpected success STOPS all later work. Preserve
the first SQLSTATE/file/phase and incomplete/uncertain receipt, suppress raw SQL/
DSN/secret-bearing errors. A disconnected psql is not server rollback. Discovery
of exact backend state and any recovery/teardown require their selected authority;
do not continue or delete uncertain evidence to manufacture an accepted run.

## Measurable default-denial checks, never forged positive Auth

Proposed slice executes transaction-local roles/claims only when separately G2
approved, labels them trusted psql role simulation, and records exact expected
SQLSTATE/result with administrative before/after counts. No live Auth account,
password, identity/session, email, JWT issuance, PostgREST or HTTP server is added.
Contexts for denied calls are strict synthetic UUID/time SHAPES ONLY, not verified
actors; their native expiry does not imply a real session exists.

- anon/authenticated/service_role cannot EXECUTE the private class entry/issuers/
  finalizers/event helpers or directly mutate/read protected journals/receipts:
  exact42501 or effective privilege refusal, never arbitrary caught exceptions.
  Assert runtime-role membership/CREATE/BYPASS attributes match source.
- After D2, all three old hit-die RPCs lose service-role EXECUTE; native public
  read_graph/inspiration wrappers under service_role return the exact documented
  unready/auth_unavailable result for valid strict context shapes. No actor/session
  provisioning or positive mechanical request; invalid input is a separate result.
- As the original private function owner in a read-only denial transaction, the
  class entry and unchanged begin/require seam raise EXACT P0001/auth_unavailable
  before histories/locks/writes. Authority Auth seam likewise; kernel dependency
  stub raises its exact P0001 unavailable message. Counts/gates remain unchanged.
- Effective helper bridges and NO caller grants match D4/D5 precisely; five D5
  column grants/policies are inspected separately from actual native FOR SHARE/
  mutation semantics. No assertion that SELECT alone permits row locking.
- Query actual deferred FK/constraint-trigger definitions and enabled BEFORE/
  AFTER guards and source-specific owner/search_path hashes, including original
  base deferred callbacks retained after D4. Catalog presence does NOT prove
  one-use/native-time/atomic command/replay/lock or concurrency behavior.

Installing a PL/pgSQL body and entering its first always-denied Auth statement does
not prove every unreachable SQL statement has been planned/executed. Namespace,
positive source-reader/lock/finalizer behavior, metadata-only+ordinary revision
participation, fresh0 bootstrap, history/copy lineage and expired-after-wait replay
need later finite native profiles AFTER actual producers/Auth/fences exist. Do not
temporarily enable gates, replace verifier, seed forged journals or add a check
extension/services to obtain a positive result here. Current pure-model172 and
other local suites remain separate reference/static evidence.

## Resource/access approvals still unanswered

G1 is unchanged from the digest-pinned runtime plan: at most one startup of the
existing user-local Docker Desktop; three exact linux/amd64 pulls,20GiB free floor,
8GiB monitored logical image budget,10MiB nonsecret evidence. Shared startup may
restore unrelated restart-enabled containers; preserve them. No test container,
credential or SQL follows from G1. Current local observation: Docker29.6.2 and
Compose5.3.1 exist, Desktop installed, Linux pipe absent; Supabase/psql not PATH.
The lane uses container psql, so no new CLI installation is required.

G2 remains actual human approval of isolated bootstrap/SQL/profiles/fixtures/teardown
and scratch secret handling. Same exact resources ONLY:
`inkborne-equipment-e1-20261011-{db,auth-migrate,storage-migrate,net,db-data,db-config}`
under `C:/Users/kaios/Documents/Codex/2026-10-11/task-2/equipment-runtime`.
Private internal network, ZERO published ports; no gateway/Auth/Storage HTTP/Studio/
mail/Realtime. DB1GiB/1CPU/256PIDs; Auth256MiB/.5CPU/128PIDs;
Storage512MiB/1CPU/128PIDs; one-shot jobs sequential, restartno.

Images, unpulled/unstarted by this task:

- Postgres17.11.0.004: `supabase/postgres@sha256:06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108`.
- Authv2.196.0: `supabase/gotrue@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232`.
- Storagev1.74.0: `supabase/storage-api@sha256:f1546fac6d1c7e345428ac904bfaa7be7cecd50a1f549fe1cf38c628a7b15c85`.

Actual pinned binaries/Storage migration entry and real Auth/Storage bootstrap
compatibility must be inspected before jobs run. Scratch PG password/JWT secret
come only from separately selected ephemeral memory or expressly approved ACL-
protected ignored material; no .env copying/default fallback/hosted keys. Scrub
output and discard selected secrets after approved teardown. No secret was read
or created here. Preserve shared daemon/cache and predecessor receipts.

Use existing R07 transport limits30s metadata/120s client,60s statement/5s lock,
2MiB captured output and256 audited tables. Propose new disabled-profile15minute/
500-command total cap and10MiB sanitized evidence cap, separate from unchanged
R07.2 15minute/6500-command fixture budget. Check remaining budget before each step.
Record actual OS PID/birth/parent/command/launch cwd/start/end and backend/session
IDs where executed; compare memory/CPU/process/listener before/after and verify
only exact owned resources absent. No global prune/stop/kill-by-name.

## Separate future sharing, restore and release profiles

R13 ordinary-item sharing has a reviewed plan and pending isolated stage/source.
It is NOT present in9a2870c staged inventory; no object names/hashes/native claims
are invented here. Add only a separately frozen future profile after exact source/
owner review with its own share/revoke/CAS/historical-pin/account/privacy fixture
budget and compatible predecessor catalog. Never silently include it in D1–D5.

G5 backup work is separate from this runtime: exact existing Unraid target/access,
fresh encrypted scheduled dump+Storage/offsite evidence and a bounded isolated
restore/cleanup package remain open. Current restore-drill uses a17.6.1.150 tag,
name-based temporary cleanup, --no-owner/--no-privileges and three row counts.
That cannot accept real restored permissions/private receipts/RLS or Storage object
contents/usable uploads. Prepare those explicit checks/resource/secret/notification
and offsite cost choices before real G5 execution; no backup mutation or upgrades
are proposed by this G2 plan. R01/R04 provider/admin and publication remain G3/G4/G5.

The last installed R03 report is8 UNACCEPTED development-chain highs/zero critical/
zero production findings (braces GHSA-vfj7-8cjw-p6xm chain), not the earlier23.
No new audit/registry/network check or risk acceptance is performed/inferred.

## Smallest implementation child after independent challenge

Own only NEW `scripts/core-db-verification.ts`,
`scripts/core-db-verification/{preflight,disabled-assertions}.sql`,
`tests/scripts/core-db-verification.test.ts`,
`tests/supabase/core-db-disabled-profile-contract.test.ts` and one handoff.
No product/stage/migration/role/Auth/R07 source rewrite, dependencies or launch flags.
Freeze-only mode hashes local committed source/predecessor files without Docker;
native modes refuse missing actual new G2 approval/hash/target/profile lineage.
Injected tests cover wrong bytes/order/target/missing-original-receipts, uncertain
commit/first-error stop, budgets, exact source/role/denial tokens and no accidental
positive Auth or extra future profile. They are NOT SQL engine/role proof.

Both original-owner families and runtime owner challenge this concrete profile
before code. Then separately released narrow package tests/typecheck/lint and
root combined gates; no SQL/Docker/install/network during source implementation.
Actual native checks wait for G1/G2 authority. This plan completes only preparation,
not M1/database acceptance, new class availability or beta readiness.
