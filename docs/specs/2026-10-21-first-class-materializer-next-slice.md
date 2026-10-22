# First-class materializer slices — dependency and allocation calculations implemented

Continue M1/M3/M4/M6 from source 29b6cc8 and the
[completed G2 baseline](../handoffs/2026-10-21-g2-baseline-complete.md).
The dependency calculation described below is now staged source; B1–B3 remain
ordered implementation work. This implements no issuer, replaces no materializers,
grants no runtime permissions and authorizes no native profile. Retain the
reviewed [prerequisite A contract](2026-10-13-first-class-acquisition-prerequisites.md).

## Implemented dependency calculation before B1

`supabase/staged/class-first-acquisition-dependencies.sql` defines the read-only
`private.resolve_first_class_dependencies_v1(uuid,uuid,integer)`. Its exact target
and class version select accessible same-system frozen content; these arguments
are calculation context, not actor/ownership/bootstrap evidence. Complete dormant
feature/spell grants retain minimum unlock and first source ordinal. Raw native
snapshot rows retain fields the TypeScript parser discards. Hypothetical level-one
feature contexts and physical spell defaults follow the original SQL projections.
Current arbitrary character choices do not become calculation authority.

It intentionally admits finite well-formed manifests only: strict feature strings,
integer-text numeric feature levels1–20, native object/array/string spell forms,
4096 raw references per family/candidate domain/exact versions (controller included),
and a 4MiB complete output bound. Missing/inaccessible dependencies refuse23503;
malformed22023; bounds54000; highest feature-rank ties23514. Historical spell slugs
that select one active content ID also refuse23514 because canonical representative
selection would require grant IDs not yet allocated. Duplicate same-slug references
merge harmlessly. No recursion, missing-entry skip or truncation is allowed.

Atomic CREATE/OWNER/REVOKE fails on an existing object, uses STABLE SECURITY INVOKER,
empty search_path and postgres ownership, with execution revoked from PUBLIC,
anon, authenticated and service_role. No new runtime-role grant or caller exists.
Native installation must verify actual default ACLs and resulting privileges;
the offline model is not native privilege acceptance. Source/fixture review passed
and 30 focused differential tests passed. [Evidence/limits](../handoffs/2026-10-21-class-dependency-descriptor.md).

## Implemented allocation and save-evidence compatibility before protected B1

`supabase/staged/class-first-acquisition-allocation.sql` defines
`private.allocate_first_class_save_envelope_v1(jsonb)`. This closed invoker calculator
reads actual parent/header/order rows and admits only the structurally untouched
new-character/null-campaign/subclass-null/zero-revision profile with empty native
domains. Structural correspondence is not genuine bootstrap or actor evidence.
It accepts only the strict original add_class request, using lowercase RFC UUIDs
(or exact nil/max) compatible with the current schemas. Caller-supplied allocated
native row IDs, timestamps, actor, graphs and allocation maps are not accepted;
character/operation/content identifiers remain the strict request's inputs.

Native UUIDs cover acceptance proposal, occurrence, controller, every dormant/active
grant and active projection. Typed rows preserve all actual parent/header fields;
the proposed choices contain occurrence_id/slug/level1 and omit a subclass property.
Projection created_at uses transaction_timestamp; occurrence selected_at and proposed
receipt accepted_at share a separate clock instant, retaining native/raw versus
canonical receipt timestamp representations. The full graph's order arrays follow
source traversal, and exact versions use the original reader's UUID/integer sort.

The proposed graph, full native row envelope and exactly three private transitions
(origin, occurrence, class_receipt) are distinct. Public refs/grants/spells are never
inserted into the private transition protocol. Graph/domain/request/combined-envelope
bounds remain 4MiB/4096/32KiB/8MiB. No journal, protected plan, proof or character row
is written; no runtime grant, lock certificate or positive acceptance is created.

`lib/character/class-role-effects-native-graph.ts` projects a bounded exact native
graph into the existing advisory classifier. It checks source/version closure,
domain order and controller/grant/projection links; subclasses are explicitly
unsupported. Raw effects/data and source order remain unchanged. Native occurrence
controller fields are checked before projecting the strict advisory occurrence DTO.
The caller supplies system/proficiency inputs and any existing advisory manifests;
the adapter never manufactures a compiler manifest or confirmation. Missing evidence
and legacy save namespaces remain unavailable. No application consumer is enabled.

Source/fixture review and all 29 focused offline tests passed. Fixture manual DML
roundtrips the entire allocated graph through the unchanged final reader and checks
original SQL/TypeScript receipt/transition shapes. This is row/save-evidence
compatibility, not B2 materialization or the genuine B3 choices update. Protected
preacceptance inputs/storage must still bind the envelope before acceptance; the
existing postacceptance inputs callback cannot be used to calculate its own graph.
[Detailed evidence and limits](../handoffs/2026-10-22-class-allocation-save-integration.md).

## Resolved prerequisite and its limits

The next calculation-evidence checkpoint is now implemented in
`supabase/staged/class-first-acquisition-calculations.sql`. Its closed native
history reader validates the exact original creation receipt/journal/preinsert
identity and two consumed proof sets against actual empty parent/header/order and
domains before any future acceptance exists. The insert guard calls that reader,
then the native allocator, rechecks history/before-state correspondence, and derives
all stored fields itself. It accepts no caller history, actor, envelope, ID or time.
Only the strict request's character/operation/content identifiers are inputs.

Records have an immutable `unverified_preacceptance_calculation` kind, native xid,
target/subject/operation/bootstrap identities, complete history and exact allocation
envelope. History/envelope/whole-record bounds are8/8/16MiB; request remains32KiB.
Protected columns have no defaults before the BEFORE INSERT guard. UPDATE/DELETE
and statement TRUNCATE refuse. FORCE RLS uses an explicit postgres-only policy;
no application/runtime table or function access is granted. Closed invoker functions
avoid assuming EXECUTE on original class-owned private helpers. Owner DDL/bypass is
outside this ordinary-caller protection, and the owner policy is not authentication.

Existing class-command identity refuses before NEW checks and routes no unauthenticated
receipt return. Same-xid exact-intent calls return the original stored calculation;
changed intent refuses. A new transaction rechecks/derives fresh evidence rather
than reusing historical rows. No permanent unique(character,operation) strands an
intent after a harmless committed calculation. No FK adds constraints to existing
parent/history deletion, or creates a cycle with the future acceptance journal;
retention/lifecycle policy must therefore be accepted before native installation.

All 62 focused tests and independent source/fixture review passed. Manually seeded
offline history is not genuine bootstrap issuance. This storage remains distinct
from protected verified B1 planning: future native Auth/locks/content/writer closure
must derive a NEW separately typed plan, not promote/adopt this record or its IDs.
[Evidence and limitations](../handoffs/2026-10-22-class-calculation-storage.md).

The 13 original materializer/reconciliation/support functions are owned by the
actual local postgres role, BYPASSRLS but not SUPERUSER. Their source-body/security
declarations match the frozen migrations. Public reconciliation RPCs are executable
by authenticated and service_role; private function EXECUTE is absent for both,
and service_role has no private schema USAGE. Those observations rule out silently
calling private materializers as the service role or adopting public auth.uid()
RPCs as verified-context issuers. Do not transfer original function ownership,
grant class/authority roles postgres membership or add broad caller privileges.
Hosted metadata must be captured separately before any hosted cutover.

The staged class and authority roles were absent in this baseline. Their declared
rights remain source contracts, not newly observed native rights. Original owner
OID 16384 is run-local evidence; future installation checks must resolve and bind
the actual owner on the selected target. Independent review has now checked the
13 bodies/metadata, 52 privilege rows and all11 trigger declarations. Only five
trigger function bodies/bindings were among those13; six others and native
column-name/WHEN/constraint relationships remain uncaptured. The descriptor's
source review does not release a positive B1/B2 acquisition path.

## Finite child boundaries

| Child | Concrete responsibility | Release condition |
| --- | --- | --- |
| B1 protected native allocation plan | Derive complete native row identities, timestamps and dependency tuples for occurrence, controller pin, grants, derived refs and auto spells before immutable P1 acceptance | Reviewed exact owner/capability matrix and canonical calculation/lineage contract; no caller-supplied IDs or graph authority |
| B2 plan-aware materialization | Consume only the protected current transaction/target plan; preserve exact IDs and full expected graph through original trigger/materializer/reconciliation paths | Explicit behavior for every affected original function and ordinary legacy writer; no late allocation-map/expected_graph rewrite |
| B3 actual choices writer and proof observation | Couple the actual guarded OLD/RETURNING parent rows, choices/level update, shared revision and order rebind to assigned→observed proof in the same transaction | Narrow column rights, all-writer fences, exact receipt-first replay and failure rollback; no observer-after-arbitrary-DML shortcut |

These are ordered design/source boundaries, not three accepted implementations.
Do not publish a positive first add_class command after only B1 or B2. Preserve
independent refusals in inputs, proof DML and observer until their actual producers
exist. Keep Auth/readiness disabled throughout unaccepted source preparation.

## Required B1 contract before implementation

1. Enumerate the exact row types and full native allocation envelope, including
   both materializer grant families, active derived refs and auto-spell rows.
   Every identity must be generated by the native producer before immutable
   expected_graph acceptance; no UUID prediction, ID mutation after insertion,
   omission of generated grants, caller graph or retrospective lineage.
2. Name the precise protected storage owner, input reader, allocator, consumer
   and bridge function owners. Installation owner is not inferred to be a staged
   runtime role. Explain every table column privilege, EXECUTE bridge, RLS rule
   and immediate immutable/admission trigger; postgres's observed bypass cannot
   be treated as a proof predicate. No broad service_role/private access.
3. Bind current transaction, verified actor/context, owned target, operation ID,
   exact content/version/system and untouched genuine bootstrap lineage. Current
   rows equal to expected values are insufficient evidence of authorized DML.
   Keep the finite initial subclass:null restriction explicit; required subclass
   support and race/background/ability-first drafts remain tracked adapter work.
4. Derive values from frozen native content and canonical existing computations.
   Identify the exact compiler/feature-generation source and earned-feature
   lineage needed by M6; do not invent an alternate calculator to fill a graph.
   Retain original 4 MiB graph, 32 KiB request, 4,096/domain, 1,024/transition and
   combined 8 MiB phase-envelope bounds; refuse incomplete/truncated discovery.
5. Specify one-use consumption, lock/order discipline, missing-response recovery,
   receipt-first current-owner replay and expiry recheck after waits. Failed
   materialization must leave parent, grants, refs, spells, order and proofs at
   the exact prior state. Locks or positive recovery are not established by G2
   catalog reads or pure-model tests.
6. List every original materializer/public reconciliation/trigger writer affected
   by a planned class transaction and every ordinary path that must retain its
   existing behavior. An isolated new bridge does not fence old direct writers.
   Do not patch the existing acceptance journal or metadata-only event protocol
   into a choices-changing acquisition without their complete reviewed closure.

After the design is challenged, implement only its reviewed finite source child,
with meaningful refusal/identity/order/rollback tests and `npm.cmd run check`.
Positive native stage/fixture/race execution needs its own concrete authorized
profile; baseline approval did not include those writes. Browser/provider and
hosted acceptance remain separate. M7 stays paused; Vercel hosting is unchanged.
