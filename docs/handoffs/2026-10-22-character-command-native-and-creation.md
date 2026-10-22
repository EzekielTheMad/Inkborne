# Native session checks and guarded creation

Current executable checkpoint: `ad94e2f`; creation: `e055189`; server bridge: `bdffb9e`.
The human request to continue the next five checkpoints authorizes bounded local
implementation and disposable verification. Hosting stays on Vercel; M1–M6/M5.5
remain active; M7/creature imports remain paused. No push, deployment, hosted
database/configuration change or production save activation occurred.

## Five work areas

| Work area | Observed status |
| --- | --- |
| Native database/session/ownership matrix | PASS in the bounded selected-row profile, including extended25 cases. |
| Real Auth/session/provider checks | PASS in the pinned disposable profile; full configured-session policy and Next cookie plumbing remain separate. |
| Server context to protected creation command | Implemented and reviewed; 77 transport/closed-SQL tests pass. No app caller or real PostgREST HTTP RPC proof yet. |
| Genuine creation/class acquisition | Actual guarded empty-character creation/recovery passes23 offline SQL tests. Protected B1 storage/binding now passes33 offline SQL tests. Native creation/B1, B2 materialization and B3 choices update remain open. |
| Create → save → reload → play/retry/conflict in the app | OPEN. No browser acceptance or production activation is claimed. |

## Native evidence

All evidence paths below are beneath
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-runtime`.

- Original8 run: `evidence/character-rows/20261022T171007.347Z-bf038f3c19be`.
  Frozen source `c888d06`; package SHA256
  `eee778eb376d89ffa412f054b2499c7ea7170e480e7f02edda72df8afb5d2972`.
- Extended25 run: `evidence/character-rows/20261022T171756.894Z-f7f37f8fba68`.
  Frozen source `b64c27d`; package SHA256
  `7e699f9a12138ed4ac008bf2bf43e4fd4567b89cea5bc4d8a874bb27791734d2`.
  Exact25 ordered cases passed, with28 actual lock edges, JWT and session
  not_after expiry at all five lock sites, four complete-row mutation/rollback
  digests and one read-only digest. Three persistent clients exited normally;
  exact backend and owned-resource absence checks passed.
- Real provider run: `evidence/character-provider/20261022T174321.421Z-800fb74b02d6`.
  Frozen source `d742711`; package SHA256
  `36cbe9fbfde3e371b0e1cfbee3b7e2f4acca2065d917ebb1ab0821eef5ba3a65`.
  All nine lifecycle cases passed: login/current ownership, refresh, local and
  global sign-out, password invalidation, ban/unban, logout blocking, soft delete,
  and hard-delete cascades. Eleven positive production-resolver verifications
  each made two real installed-SDK `/user` requests. Seven refusal lookups
  returned403. Fifteen native selected-row checks had the expected outcomes.
  Auth backend2020 actually waited for checker1603 before logout completed204
  and its session disappeared. Six persistent clients exited normally; backend,
  exact3-container/network/2-volume, and606 process-identity absence passed.

Independent source and evidence reviews passed for these bounded profiles. They
use real PostgreSQL17.11 and Auth2.196.0, SDK2.110.7 and Node24 in the test agent.
The installed production resolver is bundled unchanged; only its cookie-client
factory and server-only module boundary are fixtures. This is not actual Next
cookie plumbing, PostgREST HTTP RPC, arbitrary provider policy or hosted evidence.
Session timeout settings were absent in the actual environment and interpreted
against pinned source; `parsedSessionConfigObserved` remains false.

Failures are preserved: provider v2 stopped before Auth startup because CREATED
Docker endpoints do not yet have a NetworkID. The reviewed correction checks
the exact configured network before startup and actual network ID afterward.
The first v3 launch omitted the required TypeScript loader and failed preflight
with no resources; the corrected launch used the same frozen package. Late PID
matches were reuse, not leaked clients. The provider final identity readback also
corrects PowerShell's DateTime reparsing issue; no unrelated process was stopped.
Shared Docker engine/cache were intentionally retained under G1.

## Implemented creation boundary

`character-command-actor-rows.sql` adds a closed postgres invoker prefix for
actual user/session/profile rows without requiring a nonexistent new character.
Fifty offline tests pass; the original accepted target-row functions remain
byte-unchanged.

`character-creation-server-bridge.sql` exposes one strict public service-role RPC
under a table-free, isolated gateway owner. The gateway can execute only the
actor-prefix shim and the two existing creation/recovery entries. Service role
receives no private schema usage. The server-only transport takes only strict
intent/operation input, runs the no-argument same-token verifier and sends one
cookie-free service RPC. It rejects mismatched/malformed/raw-normalized receipts
and never falls back or changes an uncertain operation ID.

`character-creation-native-admission.sql` is an atomic, finite creation-only
overlay. It retains actual native IDs/times, the original acceptance journal,
two consumed row proofs, physical parent/origin/receipt/order writes, full graph
readback, immediate guards and deferred finalizers. Recovery happens before NEW
system admission. General class/hit-die Auth helpers, both global gates and all
13 readiness rows remain denied. No app caller or materializer is activated.
Service credential holders remain trusted context issuers; the database row
prefix does not cryptographically establish SDK verification.

The native installer is explicitly distinct: direct SUPER `supabase_admin`
installs isolated-owner core/bridge stages, while the accepted actor prefix is
installed directly as postgres. Native postgres is NONSUPER/BYPASS and cannot be
assumed to own/read SUPER-created private tables. No broad privilege repair is
authorized by a test fixture. The proposed new creation-only profile omits the
unrelated equipment stage, whose private service-role access conflicts with this
finite gateway contract; it does not reuse or fabricate the old equipment/core
harness lineage. Full native installation remains pending.

## SQL defects discovered by real execution

Complete original producer execution exposed two defects that earlier static or
extracted-function tests missed. The copy-lineage IF needed parentheses around
its CASE operand (42601). The common graph assertion's SQL alias `choice`
collided with its PLpgSQL loop variable (42702); it now uses an explicitly
qualified `selected_choice.value`. Both are narrow, independently reviewed fixes.
The corrected producer blob is `3ad143c239c404f2393a14fb98eb46fc223c46cd`;
the common assertion body MD5 is `bc903e21c8921db490a1ccc1be64e52c`.
Both current staged dependency tables and their exact-source tests pin the new
body; historical handoff/source identities remain historical.

The first fixture failure (missing actual kernel RPC), original parse failure,
and six positive runtime failures are retained. The fixture now installs the
complete unchanged kernel/authority and corrected producer; no positive Auth or
finalizer stand-ins replace their guards. It still extracts bootstrap functions
and capability tail, so its result is offline execution, not full bootstrap
installer acceptance. Actual nonSUPER/nonBYPASS class/authority execution and
active RLS are asserted.

## Verification and next work

`ad94e2f` adds one sealed B1 plan table and five closed functions. The postgres
planner/insert guard uses the accepted actor prefix and a narrow class-owned
bridge for actual private history; it does not gain private-table SELECT. Nine
explicit pure-helper EXEC grants plus lock-only order-key rights support that
bridge. The planner remains owner-only; isolated class/API roles cannot mint a
plan. The original unverified calculation table is never adopted. Native values
are derived before any pending journal, and an additive trigger binds the exact
context/intent/history/envelope/current xid/receipt to first-only acceptance.
Plans cannot be mutated or reused across transactions. Content table SHARE
locking excludes ranked-candidate phantoms. All14 history/graph relations require
unconditional class visibility with no applicable restrictive SELECT policy.
No original function body, general Auth seam, readiness flag or app caller changes.

All33 focused B1 tests pass at `evidence/local-class-plan-20261022T181229Z`;
all six recorded identities exited. The reduced fixture uses SUPER-created
private tables and a separate regular-OID postgres role actually demoted to
NONSUPER/NOBYPASS, with no private-origin SELECT. Extracted original helper ACLs
are retained; removing four required EXEC capabilities causes actual42501.
Tampered/stale journals are rejected by the real original guard or sealed binder,
with exact expected errors. The immutable OID10 bootstrap-role limitation and
initial expectations were diagnosed; all failed attempts are preserved. These
are synthetic offline results, not genuine bootstrap/native B1 acceptance.

At `e055189`, `npm.cmd run check` passed typecheck, zero-warning lint and
**374 files /5,343 passes /three existing UNVERIFIED M5 skips**.
Evidence: `evidence/local-check-20261022T175456Z`; all586 recorded identities exited.
The creation server/closed bridge77 tests passed; positive guarded creation23
passed at `evidence/local-character-bootstrap-20261022T175304Z`.
No browser workflow changed or ran in this checkpoint. The full check must be
refreshed for B1 before final delivery.

Continue full native creation installer/role/commit/rollback/recovery acceptance,
then native B1 acceptance, original plan-aware B2 materializers and actual B3 choices/revision/order
writing. Do not adopt the explicitly unverified calculation table as a protected
plan. Only then wire and verify actual application recovery and gameplay. A later
real SDK HTTP RPC/browser profile needs PostgREST; image metadata research alone
does not supply that component or prove HTTP acceptance.
