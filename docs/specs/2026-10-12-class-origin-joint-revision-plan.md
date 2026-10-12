# R06/R12 P1b.1 — protected metadata-only revision participation

2026-10-12, PLAN ONLY. Owned branch codex/r12-passive-features at
4a955c16b93a7d536b2111d72b85154d08cc673a; only this plan and its handoff change.
This refines the approved P1 plan's joint metadata branch. It does not implement
a producer, authenticate a caller, enable a writer, or make NEW classes available.

## Exact source and observed gap

| Source | Frozen correspondence / relevant functions |
| --- | --- |
| R09 `supabase/staged/hit-die-authority-and-writers.sql` at 66621332b69b5f25a93df55ccf1bb73a67ad7d4d | Git blob 8ba4f0b46594bb842c13579e52cb80633abb4c20. `lock_character_writer_guard_v1` exclusively locks singleton FOR UPDATE. `hit_die_character_revision_v1` increments on state/base_stats/choices/level/system/campaign/archive/owner change; otherwise rejects a changed counter. `hit_die_order_revision_rebind_v1` AFTER UPDATE changes only producer_revision. |
| Same R09 file at root frozen 1d028063b8bc5bf2e82bc4de54b80999f44862fa | Blob 7f8650efc96617063cf03e6ea4c5763f684ce72c. The 33-line diff adds reader/version-time/context-v2 details; the guard/revision/rebind functions and privileges above are unchanged. Neither snapshot is an unfrozen worker diff. Preserve these reader changes. |
| P1a `supabase/staged/class-origin-producer.sql` at 00dce15437561c824491063d877bfcc10184aafb | Blob 3e39a6c96e638aea87e39ee9fbd34f915a20758d. Actual acceptance guard :322, transition guard :372, protected row guard :392, graph reader :441, normal finalizer :590, bootstrap :641, dispatch/deferred :702/:710. |

P1a's BEFORE protected-row trigger consumes exact OLD/NEW proof *before* the row
is stored. Therefore a consumed origin proof alone cannot witness a stored change.
Its acceptance Boolean revision_transition_consumed can presently change false→true
without proving an actual parent UPDATE. Normal finalization requires before+1 and
that Boolean, but cannot produce either. The R09 BEFORE trigger rejects a revision-only
UPDATE when the watched parent bytes are unchanged. These are concrete source gaps.

Already-first confirmation changes private role authority: actual provisional selected
occurrence→accepted/acquired level1, actual draft header→recorded/class sequence+1.
Its current class level may be1 or higher and it may already be first among several
classes. None requires changing HP order, choices, level, state, or a timestamp.

## First child scope and explicit contract amendment

Only `confirm_origin` with already-first selected occurrence and otherwise identical
parent/order arrays is supported by this joint child. The private helper takes one
acceptance UUID; no actor, desired counter, raw parent patch, or command input.
Other class commands and confirmation moving another class first remain unimplemented.
Do not silently route them through this branch or count two bumps as participation.

Add one retained, protected revision-event proof. The existing command request and
receipt discriminators stay unchanged; this is internal transaction evidence, not
browser input or Auth. The P1a Boolean becomes a checked projection of an *observed*
event, rather than independent authority. This proof/phase invariant is a finite
amendment requiring independent challenge before implementation.

Proposed `private.class_origin_revision_events_v1`, primary key acceptance_id,
FK to P1a acceptance ON DELETE RESTRICT; unique(transaction_id,target_character_id).
No deletion/lifetime shortcut. Event identity and snapshots are immutable:

| Field | Required meaning |
| --- | --- |
| event_version / mode | Exactly1 / metadata_only_confirm. No bootstrap or general writer mode. |
| acceptance_id, transaction_id | Exact pending P1a acceptance UUID and native pg_current_xact_id(). DTO uses the existing canonical transaction-ID representation, never JS Number. |
| target_character_id, verified_actor_id, operation_id | Derived from that protected acceptance/receipt; exact current owned parent. No role/GUC/current_user inference. |
| before_action_revision, after_action_revision | Native bigint before and exactly before+1; DTO decimal strings in0..9223372036854775807. Refuse exhaustion before mutation. |
| origin_transition_key / occurrence_transition_key | Exact [target UUID] and [selected occurrence UUID], pointing to one consumed proof each in this same acceptance. |
| before_parent / expected_after_parent | Complete actual locked parent snapshot and protected expected parent; identical except action_revision. Preserve absent keys/raw extensions. |
| before_order | Actual existing producer_version1/order with producer_revision=before, exact character and all five ordered ID arrays. No INSERT, array synthesis, sorting, or backfill. |
| phase | Exactly pending→assigned→observed; no reverse transition/reassignment. |
| observed_parent / observed_order | NULL in pending/assigned; nonnull complete actual readback only in observed. Parent equals protected expected; order equals before_order except producer_revision=after. |

Strict internal event schema rejects extras, partial phase tuples, changed identity,
negative/exponent/unsafe counters, fake observation, and bootstrap substitution.
Use actual native times in existing origin/receipt; this proof invents no new acceptance
clock. Aggregate serialized proof budget8MiB UTF8 (all snapshot fields together),
with existing bounded P1 graph/row/array limits still required. This is a source/model
bound, not a transport or PostgreSQL row-overhead guarantee. Oversize refuses; no
projection/truncation to make a graph fit. No schema change is made by this plan.

## Concrete PostgreSQL dispatch and atomic ordering

Proposed source installation order: UNCHANGED reviewed R09 authority, UNCHANGED
reviewed P1a, then ONE new UNAPPLIED
`supabase/staged/class-origin-joint-revision.sql`. No function or trigger referring
to joint objects is added to either earlier base file. This corrects the5883d76
definition-order HOLD: do not rely on deferred PL/pgSQL body validation, a later
concatenation, or forward references to objects absent when a function is defined.
The joint stage is one source transaction, not a migration or activation manifest.

Single future source writer: the class-origin worker owns the ENTIRE new joint file.
R09's authority-source owner independently reviews its R09 object family read-only;
the class-origin reviewer reviews the P1 family. Root is sole integration writer.
No two agents edit the joint file, and neither frozen base stage is edited. Every
replacement retains the existing function's signature, original owner and fixed
empty search_path; the joint stage closes all new/replaced function privileges in
the same transaction before COMMIT.

### Exact joint-stage object definition order

These are proposed callable signatures/owners and a dependency sequence, not SQL
execution. Existing public/private tables, base class shape/guard/finalizer functions,
shared guard and R09 parent/order triggers already exist from the two unchanged bases.

1. BEGIN; verify those exact prerequisite object signatures/owners/source manifest.
   Create `private.class_origin_revision_events_v1` with native-only column CHECKs,
   PK/unique constraints and FK to existing acceptance. No CHECK invokes a new function.
   Assign `inkborne_hit_die_authority_owner`; enable RLS, revoke all caller privileges,
   and create authority-owner row policies plus class-owner SELECT-only policy FIRST.
   Define no dispatch/constraint trigger yet; this stage issues no event/parent DML.
2. Define `private.class_origin_metadata_delta_v1(p_acceptance uuid) RETURNS jsonb`,
   SECURITY DEFINER, owner `inkborne_class_origin_owner`. It validates actual stored
   class metadata/consumed proofs and derives the bounded immutable candidate from
   existing journal/receipt. It may read the already-created event table, but calls
   only existing base helpers. It does not insert an event, bump a counter or authenticate.
3. Define `private.class_origin_observed_revision_v1(p_acceptance uuid) RETURNS jsonb`,
   same class owner/security. It calls step2, requires current observed event and exact
   current parent/order, and returns its checked bounded proof. It does not require
   finalized acceptance/inserted class receipt, so it can validate Boolean consumption
   AFTER readback and BEFORE the outer producer inserts that receipt.
4. Define `private.class_origin_assert_metadata_revision_v1(p_acceptance uuid) RETURNS void`,
   same class owner/security. It calls step3 and adds finalized normal acceptance,
   consumed Boolean and actual immutable class receipt correspondence for finalization.
   Define `private.class_origin_consume_metadata_revision_v1(p_acceptance uuid) RETURNS void`,
   same owner/security, calling step3 then changing ONLY Boolean false→true once on
   that pending acceptance. Both callees are already defined. Neither invokes itself
   or the finalizer recursively. Actual receipt insertion remains the outer producer.
5. Define `private.class_origin_revision_event_guard_v1() RETURNS trigger`, SECURITY
   DEFINER, authority owner. It uses existing tables and step2 to check INSERT pending,
   immutable identity/snapshots, pending→assigned→observed and exact NEW observed
   readback. It validates the NEW row directly; it must not call step3 during BEFORE
   UPDATE to observed, when the stored row is still assigned. No role/GUC bypass.
6. Define `private.apply_class_metadata_revision_v1(p_acceptance uuid) RETURNS void`,
   SECURITY DEFINER, authority owner. Uses shared guard, step2, event table and step4
   consumer; creates pending, performs one parent revision-only UPDATE, reads back
   parent/order, stores observed and consumes Boolean. All named callees exist now.
   The existing R09 trigger function object also exists; its replacement follows
   before any runtime dispatch trigger is installed or any data can be mutated.
7. Define `private.class_origin_revision_event_closure_v1() RETURNS trigger`, SECURITY
   DEFINER, authority owner. Calls ONLY the step4 finalized observed-event assertion;
   it does NOT call `private.class_origin_finalize_acceptance_v1(uuid)`. Unchanged
   class-owned P1a acceptance/transition deferred triggers provide full original
   normal closure through that existing dispatch. No extra cross-owner EXECUTE grant
   is needed or added. Deferred callbacks re-read CURRENT event/acceptance by acceptance_id, not an
   obsolete queued NEW.pending/assigned snapshot. Define
   `private.class_origin_metadata_revision_dispatch_v1() RETURNS trigger`, SECURITY
   DEFINER, class owner, calling steps2/6 against actual origin OLD/NEW plus stored
   selected occurrence. All direct dependencies exist before these definitions.
8. CREATE OR REPLACE `private.class_origin_acceptance_guard_v1() RETURNS trigger`
   under ORIGINAL class owner, preserving every P1a predicate and adding step3 proof
   requirement for Boolean false→true. This is the immediate consumption guard;
   no second competing acceptance trigger is needed. CREATE OR REPLACE
   `private.class_origin_finalize_transition_v1(p_acceptance uuid) RETURNS void`
   under ORIGINAL class owner, adding step4 assertion without removing any original
   normal finalizer predicate. Bootstrap finalizer/body/signature stays unchanged.
9. CREATE OR REPLACE `private.hit_die_character_revision_v1() RETURNS trigger` under
   ORIGINAL authority owner. Add the exact pending-event branch using the event table
   and step2; preserve ordinary behavior when no event exists. Existing parent trigger
   still points to this same signature/object; existing AFTER order-rebind function
   and trigger are unchanged. No missing dependency or new trigger ordering is assumed.
10. ONLY NOW create event BEFORE INSERT/UPDATE/DELETE guard trigger (step5), origin
    AFTER UPDATE dispatch trigger (step7), and event AFTER INSERT/UPDATE constraint
    trigger DEFERRABLE INITIALLY DEFERRED (step7). Existing acceptance/row-proof and
    deferred triggers retain their names/objects and use the replaced functions.
11. Close privileges in this transaction: reassert original owners/search_path,
    revoke PUBLIC/anon/authenticated/service_role EXECUTE and table rights on every
    new/replaced signature; grant only the precise internal role bridges below.
    Assert no caller membership/CREATE/extra grants and unchanged Auth/gates/readiness.
    COMMIT contains no data mutation. Later actual G2 must prove object/body/ACL/catalog
    correspondence and trigger behavior; source ordering is not deployment evidence.

The future trusted producer's outer sequence is frozen here, but that producer and
its Auth/entitlement/order seeding are NOT delivered by this first child:

1. Verified Auth/session/current-owner prefix remains unavailable today. A future
   accepted producer locks existing shared guard FOR UPDATE, then owned parent,
   origin/retained occurrences and exact sources/order in the approved stable lock
   prefix. Check stored receipt first for current-owner replay; new work checks both
   expected revisions, published system/current acquisition permission, canonical
   selected pin/occurrence and already-first HP position after waits. Capture real
   before parent/header/order and DB acceptance time; prepare immutable exact graph,
   receipt and row proofs. Never accept these protected fields from a request.
2. Insert pending acceptance and exact unused row proofs. Existing immediate guard
   verifies actual before parent/header. Update selected occurrence FIRST, using its
   exact proof; actual row becomes accepted/acquired level1/current operation/time,
   with content/version/slug/system/selection/controller pin unchanged.
3. Update origin SECOND using its exact proof: draft→recorded, selected frozen ID,
   confirmation proof, class counter+1. NEW `AFTER UPDATE FOR EACH ROW` trigger
   `class_origin_metadata_revision_dispatch_v1` observes stored header and occurrence.
   This is a real metadata event. It does not fire on draft autosave, INSERT/bootstrap,
   unchanged header, removed origin, other command, or receipt replay.
4. Dispatch resolves EXACTLY ONE current-xid, unfinalized class_transition/confirm_origin
   acceptance with consumed origin and selected-occurrence OLD/NEW proofs matching the
   actual trigger rows/current occurrence. Revalidate P1a's precise provisional→accepted
   acquisition, native chronology, frozen pin/system/root fields and owner. Parent still
   equals actual before_parent; expected after differs only in action_revision. Header
   matches expected after with class before+1. Stored order exists at before revision
   with identical five arrays. Failure raises; no best-effort catch/fallback.
5. Dispatch calls R09-owned `private.apply_class_metadata_revision_v1(acceptance_id)`.
   This SECURITY DEFINER helper accepts no requested counter. It independently obtains
   the validated delta from a class-owned bounded validator, locks/rechecks parent/order,
   creates the protected event pending, and performs the SOLE revision-only parent
   UPDATE: action_revision=locked_before+1. This genuine DB-owned counter mutation is
   neither a caller increment nor a no-op UPDATE of choices/id/updated_at. Its WHERE
   binds target/current owner/current before revision and RETURNING must yield one row.
6. Actual R09 `hit_die_character_revision_v1` BEFORE UPDATE detects unchanged watched
   fields plus changed revision. It requires exactly one pending event for current
   xid/target; validates complete OLD/NEW raw parent bytes, old counter, expected+1,
   real stored metadata and consumed proofs. It assigns NEW.action_revision=OLD+1
   and advances that event pending→assigned ONCE. Counter-only write with no exact
   pending event still raises the original23514 rejection. A watched-field change
   while this event exists rejects for this first child; do not take ordinary branch
   and metadata branch together. Ordinary inspiration watched-field behavior stays
   unchanged when no class event exists.
7. Existing R09 AFTER parent trigger rebinds ONLY the existing producer_revision.
   Its original source/body/ownership remains unchanged. The helper's nested UPDATE
   completes, THEN it compares RETURNING and freshly read stored parent/order with
   exact expected+1 snapshots/all five original arrays. Missing/stale order or another
   trigger's unexpected change raises. AFTER-trigger ordering is not assumed: helper
   readback occurs after that complete UPDATE, not in a competing parent AFTER trigger.
8. Authority helper stores observed parent/order and advances assigned→observed.
   It calls class-owned `class_origin_consume_metadata_revision_v1(acceptance_id)`;
   this checks exact observed event/current parent/order/proofs and changes the existing
   P1a Boolean false→true ONCE. The replaced immediate acceptance guard on UPDATE
   rejects false→true without that observed event, or any bootstrap. No Boolean or
   current_user privilege acts as a substitute for the actual UPDATE/readback.
9. The origin AFTER trigger returns; actual origin UPDATE completes. Outer producer
   inserts the exact immutable class receipt using its unused row proof and marks
   acceptance finalized. Normal P1a finalizer additionally asserts observed event
   correspondence; all original raw graph/revision/receipt/consumed-proof checks stay.
   Existing initially deferred acceptance/transition triggers repeat it at commit.
   A new initially deferred event constraint trigger calls ONLY the finalized
   observed-event assertion, verifying retained proof, finalized acceptance/receipt
   and exact current parent/order; it does not invoke the base finalizer dispatch.
   Unchanged P1a acceptance/transition deferred triggers retain full original normal
   graph/receipt/proof closure. Both callbacks detect their respective late
   alternate writes. Failure at any nested/immediate/deferred point rolls back all.

This order deliberately does not finalize before the class receipt exists. Consumed
private row proofs in BEFORE triggers are rechecked against actual stored rows in
AFTER dispatch. Merely planned expected+observed tuples cannot create the missing
actual event. SET CONSTRAINTS IMMEDIATE before the sequence completes refuses,
not an escape from closure. No pg_trigger_depth/GUC/current_user/caller role waiver.
The existing singleton exclusivity serializes admitted work; this plan does not prove
effective Auth/RI lock prefix or resolve unclosed external writers/concurrency.

## Trigger, owner and privilege touchset for a later challenged child

| Proposed source path/object | Sole writer / bounded change |
| --- | --- |
| NEW `supabase/staged/class-origin-joint-revision.sql` | Class-origin worker is SOLE source writer. Joint file contains ALL new class/authority functions, event table/policies/guards, actual CREATE OR REPLACE P1/R09 objects and final dispatch/constraint triggers in the ordered transaction above. Both original-owner families require independent review; R09 reviewer never co-writes this file. |
| Frozen `supabase/staged/class-origin-producer.sql` and R09 authority/kernel files | NO edits. Their byte hashes stay frozen. New class validators/consumer/dispatch and replacement guard/normal-finalizer are defined ONLY in the joint stage AFTER its event table exists. Bootstrap function/body/initial0, shared guard/rebind/reader/state source and Auth/gates stay unchanged. |
| NEW `lib/character/class-origin-revision-event-schema.ts`, `class-origin-joint-revision-model.ts`, original joint fixtures and focused tests | Same sole worker, strict internal pending/assigned/observed DTO. Model traces effective function definitions from BOTH unchanged bases and the joint stage, including replacement precedence/actual phase dispatch. No app import/provider/evaluator/C1 DTO change; existing seven P1a paths remain unchanged. |
| Actual R09 `hit_die_character_revision_v1` object | Same `inkborne_hit_die_authority_owner`, fixed empty search_path, no trigger rename/order manipulation. Replacement occurs in joint stage; original ordinary branch remains when no metadata event. Any R09 owner/object/grant drift requires renewed review, not opportunistic edits. |

Event table RLS/private schema: revoke PUBLIC/anon/authenticated/service_role all;
NOLOGIN/NOBYPASSRLS/NOINHERIT/non-super owner unchanged. Authority owner alone gets
event SELECT/INSERT and phase/readback-column UPDATE; immediate guard makes immutable
identity/snapshots and monotonic phases compulsory. No DELETE. Class owner gets
event SELECT only with explicit SELECT policy. There is no caller membership or CREATE.

Class-owned bounded metadata validator is SECURITY DEFINER under the existing class
owner (actual private-row SELECT policies), EXECUTE granted ONLY to authority owner.
Authority-owned helper EXECUTE granted ONLY to class owner for the actual dispatch;
existing authority parent UPDATE(action_revision)/order rebind privileges suffice.
Class role retains restrictive WITH CHECK(false) on parent: it cannot acquire a new
counter/state UPDATE privilege. Class-owned Boolean consumer grants EXECUTE ONLY to
authority owner; validator and consumer use exact receipt/xid/proof checks, not the
grant itself as authorization. No broad authority DML to P1 journal/origin tables.
Authority role additionally gets EXECUTE only on the finalized class event assertion
for its deferred closure, never on `class_origin_finalize_acceptance_v1(uuid)`;
the redundant call is removed rather than expanding privileges. The observed-proof validator is called within class-owned
functions and needs no cross-owner EXECUTE grant. Class validator and consumer read
the event via explicit SELECT-only policy; no authority-owner broad
P1 journal DML. New guard/dispatch trigger functions gain no callable caller grants.
Finalizer event assertion is callable only by these internal owners as narrowly required.
Function defaults are revoked in the same source transaction. ACL/ownership/proposed
installation references need independent source review AND later real role/RLS proof.

All functions are private. `require_class_origin_auth_v1` and
`require_verified_hit_die_auth_v1` retain unconditional auth_unavailable; existing
begin entry still cannot issue an acceptance. Gate CHECK(NOT enabled) unchanged,
all13 readiness rows false, no mark-ready API/caller marker issuer/public new RPC.
Internal source event mechanics are not positive authentication or app availability.

## Finite meaningful acceptance and before controls

Source-only preparation uses original canonical class/pin/occurrence/receipt fixtures,
not book content or an independent counter calculator. Positive status model_checked
only. Actual model must trace origin AFTER dispatch → authority helper → actual R09
BEFORE branch → unchanged order rebind → actual event observer/consumer → real P1a
immediate/deferred finalizers. Removing any critical body/predicate must refuse the
model, separately from semantic before assertions.

1. Only level1, only higher-level, and already-first multiclass confirmation: real
   metadata change, parent raw bytes unchanged except revision, class before+1,
   shared before+1, order producer before+1, every ordered ID array unchanged. Test
   ordinary inspiration/no-op unchanged against original frozen branch separately.
2. Semantic before uses coherent original R09/P1a source/model fixtures: construct
   model successfully, confirm original positive dispatch controls, then demonstrate
   revision-only parent update fails23514 OR missing observed-event check accepts a
   forged Boolean. Do not count constructor/missing-body/collection failures as
   before evidence. Preserve exact bytes/blob hashes and try/finally restoration.
3. Reject fake/foreign/current-user/GUC event, wrong xid/actor/target/op, extra event,
   bootstrap, finalized marker, no actual metadata delta, unconsumed/wrong selected
   occurrence, raw pin/system/content/version mismatch, class counter not+1, selected
   accepted time not receipt time, parent raw mutation and unknown/missing order.
4. Pending alone cannot set Boolean; assigned alone cannot finalize. Before/after
   parent aliases, selfconsistent forged expected graph and event, wrong observed
   order, replaced arrays or event phase skip/reuse reject. Retain precise same-op
   consumed transition identity; no second UPDATE, second event, second Boolean or
   counter overflow can pass. Fault after assignment/rebind/observation/receipt or
   deferred closure leaves no partly accepted result in future runtime tests.
5. Same committed operation/current owner replay returns original receipt and never
   emits a new origin update/event/bump. The real receipt-first producer remains a
   later child: this first source model does not prove real replay/Auth. Different
   operation trying to reseal same recorded origin refuses. Unchanged ordinary level/
   subclass/reorder remains0 in its future adapter, not forced into this event mode.
6. Fresh, draft-copy and recorded-copy still initialize shared/class/order0, no before
   counters. This mode rejects them without changing existing bootstrap source.
   Changed-choices confirmation and other class writers remain unavailable until
   separately accepted unified one-bump participation; no two-branch fallback.
7. Prepared script gates after release: focused source/model tests maxWorkers2,
   package typecheck/lint; root combined gates later. No npm test executes SQL/PGlite.
   Separate G2 plan must prove real PG syntax/trigger nesting/SET CONSTRAINTS/native
   time/ACL/RLS/locks/concurrency/fault rollback with exact resource/role budgets and
   actual human authorization. No such authority exists today.

## Open children and stopping point

P1b.1 is one joint revision primitive, not genuine fresh creation/first-confirm API.
Still required: authoritative Auth producer; atomic fresh/equipment-create bootstrap;
actual selected class add/level/subclass/remove/reorder and changed-order confirmation;
real complete order producer; exact private-basic-class compiler and six published
ability/proficient1 indexed raw manifests; original/import unproven lineage remains
unavailable/raw-preserved. No current save_ rewrite or independent-grant removal.

P1c retains both copy bodies/multihop provenance, scoped nonclass choices and ALL
refs/grants/spells/materializer/pruning/reconciliation writers. R09 retains every
state/inventory/access/version/lifecycle/restore fence and thirteen-family closure.
P1d exact privileges/old RPC revocation and actual G2/Auth/HTTP/RI/fault proofs, C1v2
lineage/nullable-grant bridge, C2 actual save/concentration/print/UI are mandatory
before NEW structured class authoring. No empty-class/edit-only substitute.

Rollback of an eventual accepted primitive disables command availability, preserves
revision/event/origin/receipt history and fences; never restores broad legacy writer
privileges, resets counters or reseals origins. No deployment/rollback executed.

Prior reviewed references for later G2 challenge: [PostgreSQL17 trigger definition](https://www.postgresql.org/docs/17/sql-createtrigger.html),
[trigger behavior](https://www.postgresql.org/docs/17/trigger-definition.html),
[row locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[function ownership/security](https://www.postgresql.org/docs/17/sql-createfunction.html),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
No network refresh or runtime query was performed in this plan-only/heavy-hold turn.
