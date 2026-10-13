# Genuine empty fresh-character bootstrap — proposed disabled source child

Documentation only, grounded in fixed production534b5d8 and the r12 discovery of
the missing genuine fresh-bootstrap producer. Sole writer m5-campaign-monster-worker;
prior M5/M6/P1/R09 source, receipts and worktrees stay unchanged. This is a proposal
for original R09-owner + M1 challenge BEFORE implementation, not native acceptance,
Auth activation, a public issuer, equipment/copy integration or builder readiness.

## Frozen evidence and exact contract

At534b5d8 these Git blobs are dependencies, not replacement targets:

| Source | Git blob | Relevant evidence |
| --- | --- | --- |
| supabase/staged/class-origin-producer.sql | 3e39a6c96e638aea87e39ee9fbd34f915a20758d | Private journal/proofs/creation receipts; immediate preinsert guard; unchanged class_origin_finalize_bootstrap_v1(uuid). |
| supabase/staged/class-origin-joint-revision.sql | d07ce2f53b0af06950ae3eb46006906e804701ed | Bootstrap absence branch preserved; metadata revision branch is NOT used for INSERT. |
| supabase/staged/class-origin-confirmation-producer.sql | 7d0d7db1d3988e94de5143b84e7f3c89b8cb3176 | Later confirmation requires genuine finalized bootstrap history; cannot create it itself. |
| supabase/staged/hit-die-authority-and-writers.sql | 7f8650efc96617063cf03e6ea4c5763f684ce72c | Exclusive writer guard; order relation currently has no INSERT privilege/producer. |
| supabase/staged/hit-die-transaction.sql | 5d9fc835b0b8b957ca88e8fedf2ff6cc4b752faf | Native action_revision DEFAULT0; kernel helper owners unchanged. |
| lib/character/class-origin-command-schema.ts | d935b7c1bb14dedce381499ab3f21abb50efa96a | Existing strict create_character bootstrap request and separate initial receipt. |

Current app/(app)/characters/new/actions.ts authenticates getUser then directly
inserts or calls create_character_with_starting_grant, and redirects into the
editable builder. lib/supabase/characters.ts:createCharacter also inserts directly.
Neither creates protected origin/order/operation history. No compatibility
adoption of those existing rows, first-click sealing, inferred add_class receipt,
equipment eligibility inference or generated model graph is allowed here.

Reuse the strict request unchanged: contract_version1, operation_id UUID,
command:create_character, fields{name,system_id,campaign_id}. No character ID,
actor ID, timestamps, expected target revision, origin or graph is browser authority.
The producer additionally requires normalized trimmed name length1..100 and exact
stored canonical name correspondence; reject untrimmed input instead of silently
changing immutable intent. First slice requires campaign_id:null and an actual
published dnd-5e-2014 system. Non-null campaign and other systems explicitly return
unsupported before NEW work; their wider required adapters remain tracked. No
class/race/background/subclass source, occurrence, ref, grant or equipment is created.

Receipt is the existing EXACT bootstrap_new variant: receipt_version1,
operation_id, verified_actor_id, target_character_id, accepted_at, canonical_intent,
initial_action_revision:'0', initial_class_revision:'0', initial_producer_revision:'0',
copy_lineage:null. No invented created_ids/creation_operation_id/before/after field
is added to this strict receipt. The origin's creation_operation_id equals receipt
operation_id. Parent and header are genuinely newly inserted; all counters are
initial0, not a before→after transition. No UPDATE, joint metadata event, reseal,
action_revision assignment, class receipt or revision decrement/reset is permitted.

## Concrete RI feasibility; no deferred-FK exception

class_writer_acceptance_v1.target_character_id is UUID NOT NULL with NO character
FK. Its current xid8 and immutable expected_graph can be inserted before the
character exists. class_writer_row_transitions_v1 references acceptance_id only;
insert its proofs after the journal. In contrast, character_class_origin_v1,
character_creation_commands_v1 and character_projection_order_v1 have immediate
character FKs. Insert all three AFTER parent INSERT. Occurrence and class-command
tables also have immediate parent FKs but have no rows in this slice. Joint revision
events reference acceptance but no event is created. No constraint is altered or
deferred to hide ordering. Existing initially-deferred P1a acceptance/transition
closure callbacks stay armed and call the unchanged bootstrap finalizer at COMMIT.

## Actual transaction and operation recovery

1. Private entry invokes unchanged require_class_origin_auth_v1(context), then
   an R09-owned native-Auth/exclusive-guard prefix. Both Auth seams remain literal
   unconditional refusal. A future verified context must prove actor/session/config
   using the approved native verifier, not getUser/caller UUID/GUC/current_user.
   The prefix returns an actor only after actual native verification and a native
   expiry recheck following waits. No standalone sessionless actor-taking entry.
2. Under the same exclusive singleton guard, look up immutable creation receipt
   by verified_actor_id + operation_id FIRST. If present, lock its actual target
   parent FOR UPDATE with current user_id equal that actor; validate original
   receipt/journal/finalized consumed proof correspondence under existing immutable
   guards. Historical journal xid is original evidence, not current xid. Exact
   canonical intent replays the ORIGINAL receipt, different intent returns conflict.
   Current Auth/session/owner/native expiry is rechecked immediately before either
   return, equality expired. No NEW system/publication/absence/order/history-of-class
   selection/revision test blocks terminal recovery. Target missing/deleted or no
   longer owned refuses; replay does not manufacture a replacement character.
3. Only NEW work locks the actual requested system row FOR SHARE under R09 authority
   and rechecks exact ID/slug/published status after waits. No campaign/member lock
   is needed for explicitly null campaign. Recheck native Auth immediately before
   acceptance. Allocate target and acceptance UUIDs with native gen_random_uuid;
   capture finite native created_at=transaction_timestamp() (the existing now()
   default) and accepted_at=clock_timestamp() after waits. No client time/ID.
4. Before journal INSERT, construct a complete typed public.characters row from
   the fixed-source defaults described below, not an injected expected_graph.
   Native UUID/time and actual verified actor/current system are the only variable
   fields. Build exact fresh origin, creation receipt and empty order projections.
   Expected graph is immutable: parent+origin+order, occurrences/refs/inventory/
   spells/feature_grants/spell_grants/versions all[]; existing4MiB cap applies.
5. INSERT one class_writer_acceptance_v1: bootstrap_new, pg_current_xact_id(),
   verified actor/new target, before_parent/before_origin/preinsert_proof NULL,
   revision_transition_consumed:false, finalized:false, exactly TWO planned rows
   (origin and creation_receipt). Its ACTUAL immediate guard acquires the existing
   exclusive guard and verifies no target parent/header/order, then stamps native
   preinsert_proof. Receipt validity/target/actor/operation/current xid are checked.
   No caller boolean, later hidden-RLS absence inference or journal backfill.
6. INSERT exactly two matching transition proofs with consumed:false and NULL
   before_row. Parent INSERT uses native ID/time and the stated default columns;
   omit action_revision so the database DEFAULT0 supplies it. Verify RETURNING
   FULL typed row equals expected parent, encoding revision as decimal text.
   Insert origin draft/new_character, creation_operation_id=current operation,
   no origin_occurrence_id/source_draft_operation_id/role_proof, command_revision0;
   insert creation receipt keyed by actor/operation. Existing protected guards
   consume their exact current-xid target/actor/key/before/after proofs once.
7. Call the R09-owned genuine empty-order helper with acceptance UUID only. The
   class-owned validator rereads actual pending journal/preinsert proof, both
   consumed rows and actual parent/header/receipt. R09 helper reacquires the SAME
   exclusive guard, verifies all five actual public source domains and retained
   class occurrences are genuinely empty, no order exists, parent revision0;
   inserts producer_version1/producer_revision0 with five EMPTY UUID arrays. This
   is new-row initial state, no UPDATE/bump or legacy empty-order backfill.
8. Read actual full final graph and compare EXACT expected graph, row cardinalities,
   parent/receipt/header identities and system; actual RETURNING/order readback
   must prove all three revisions0 and two consumed proofs. Set only finalized:true
   on the current acceptance, call unchanged class_origin_finalize_acceptance_v1,
   which dispatches unchanged class_origin_finalize_bootstrap_v1. No manual proof
   consumption flag, revision event or extra counter. Deferred callbacks reread
   final stored rows through transaction commit; faults roll back ALL new rows.
9. Construct applied response with ORIGINAL initial receipt. Terminal native
   Auth/current owner/session/expiry is rechecked after construction, immediately
   before return. The outer call commits or fails atomically; no post-write catch
   swallows failure. Resolve uses the same auth/guard/receipt/current-owner prefix
   and returns recorded/absent/unavailable, never permission to allocate a new UUID.

Native defaults are not guessed: migrations00004/00007/00009/00037 plus the R09
kernel supply the16-column parent contract: id,user_id,system_id,campaign_id,name,
visibility:'private',archived:false,created_at:native time,level:1,base_stats:{},
choices:{},state:{},narrative:{},narrative_rich:{},primary_color:null,action_revision0.
Capture native created_at once (the source's now() meaning) and explicitly insert
it; do not predict a later clock invocation. Initialize a typed record with these
EXACT source defaults; source preflight binds column/default/trigger inventory and
rejects drift rather than filling unknown columns. accepted_at is separately native
clock_timestamp after waits; no equivalence to created_at is inferred. All parent
fields except defaulted action_revision are explicit; final full-row readback detects
any existing INSERT trigger mutation/default discrepancy and aborts. Current builder
level1 does not mean an earned/accepted first-class occurrence.

Operation uniqueness already exists at (verified_actor_id,operation_id) plus UNIQUE
target_character_id. Exclusive shared guard serializes same-operation requests
before lookup and stays held through commit, including new absence/proof/order work.
Concurrent identical operations yield one committed target/receipt or an atomic
failure; retry returns the same receipt. Different intent on same operation refuses.
Two distinct intentional operations may create two characters; no guessed name-based
deduplication. Missing receipt after timeout is not cancellation: retain SAME operation
and immutable intent for explicit resolution/replay, no automatic retry/new UUID.
Cross-session expiry after waiting denies even original replay; receipt actor/time/
initial counters never change when later target revisions advance. Later builder
mutations and deleted-target receipt lifetime need separately accepted adapters.

## Minimal new source and exact least-privilege ownership proposal

One sole source writer owns NEW supabase/staged/class-origin-fresh-bootstrap.sql,
installed AFTER unchanged kernel→authority→P1a→joint→confirmation stages. Both
original object-owner families review the entire new stage. No base file/function
replacement, role transfer/new role/membership/schema CREATE/public routine grant.

Define these NEW private objects with empty qualified search_path:

- authority owner: class_bootstrap_verified_prefix_v1(jsonb) RETURNS uuid; native
  Auth/guard/expiry only. lock_class_bootstrap_system_v1(jsonb,uuid) RETURNS jsonb;
  new-work native system locks/recheck. initialize_empty_class_order_v1(uuid)
  RETURNS jsonb; actual protected pending-bootstrap/empty-row/order INSERT+readback.
- class owner: class_origin_empty_parent_allowed_v1(public.characters) RETURNS
  boolean; exact current-xid pending bootstrap/preinsert journal/full parent-row
  match for INSERT RLS. class_origin_empty_order_allowed_v1(private.character_projection_order_v1)
  RETURNS boolean; exact current-xid pending journal/consumed target rows/empty
  domains/zero counters and order shape, not role identity alone.
  class_origin_empty_order_inputs_v1(uuid) RETURNS jsonb; internally observed
  journal/parent/header/receipt/proof correspondence for R09 helper, not supplied facts.
  create_empty_class_origin_character_v1(jsonb,jsonb) RETURNS jsonb and
  resolve_empty_class_origin_creation_v1(jsonb,uuid) RETURNS jsonb; actual private
  orchestration/immutable receipt recovery. These callable seams always fail Auth
  in this source child; no bypass parameter or test-only positive issuer.

Explicit necessary ACL amendments, all SOURCE proposals requiring joint challenge:

- class owner gets INSERT ONLY the15 explicit non-revision characters columns
  above; no action_revision/UPDATE/DELETE privilege added. New owner-targeted INSERT
  policy WITH CHECK(class_origin_empty_parent_allowed_v1(characters)), plus same
  restrictive INSERT check for that isolated owner. Existing UPDATE WITH CHECK(false)
  remains. P1 existing journal/proof/origin/receipt rights are reused unchanged.
- authority owner gets INSERT ONLY character_id,producer_version,producer_revision,
  pins,inventory,spells,feature_grants,spell_grants on private order, with owner-only
  permissive AND restrictive exact guarded INSERT checks. Existing revision-only
  UPDATE is unchanged; no array UPDATE/lifecycle/delete/legacy order privilege.
- Exact EXECUTE: authority gets only the two new class order validators; class gets
  only the three new authority prefix/system/order helpers. No authority journal
  SELECT/DML or class public system/table write grant. No EXECUTE on base finalizer
  is added across families. Context/Auth/guard stay authority-owned; exact_keys/native
  time stay kernel-owned, with existing effective privileges checked, not transferred.

Installation order: prerequisite/role/disabled/default/trigger checks; class policy
validators + observed-input functions; authority prefix/system helper then order
helper; orchestration/resolve; narrow column grants and policies AFTER functions;
exact ownership/revoke-all/exact cross-family EXECUTE in SAME transaction before
COMMIT. Functions are defined only after dependencies exist; no forward-validation
assumption. No new positive ACL is available to anon/authenticated/service_role.
require_class_origin_auth_v1 and require_verified_hit_die_auth_v1 stay always denied;
class gate false and all13 writer readiness false; no app import/entry readiness.

## Required review and later measurable gates

This plan changes NO source or native privileges. Next finite child is real additive
SQL SOURCE under both owner reviews, with bounded static checks bound to its actual
entry/ACL/order/finalizer paths; no new calculator/model/harness replacing a producer.
Exact tests/runtime preparation are a separate release. Before native acceptance,
G2 must prove real PostgreSQL owner/ACL/RLS/trigger/lock/deferred behavior; native Auth
issuer remains unavailable until its separately approved authority prerequisites.

Required source/native counterexamples: genuine no-class creation and exact two-proof
consumption; no before state; journal-before-parent actual absence, existing target or
header/order refusal; wrong actor/system/xid/preinsert key; foreign receipt/proof;
altered default/INSERT-trigger row; unexpected refs/inventory/spells/grants/versions;
nonempty order/producer_revision1; first-class pin/occurrence accidentally emitted;
extra/unconsumed/reused transition; immediate FK ordering failure; repeated finalized
journal; changing receipt; immutable original replay after later revisions or system
retirement; expiry during guard wait/before receipt return; same-op concurrent conflict,
one-target replay; fault after EACH actual phase and at deferred COMMIT leaves no
partial parent/origin/order/receipt/journal; unauthorized direct DML under every real
role, including alternate writer attempt to forge protected pending proof.

Stage rollback before activation removes ONLY this new stage's exact objects and
new column privileges/policies under reviewed deployment authority, preserving all
original roles/base stages/evidence. No runtime executes now. Once any native rows
exist, no blanket DROP/delete/cascade cleanup: fixture IDs/closed ownership graph and
transaction evidence require separately authorized exact cleanup. Declared parent
CASCADE FKs are not proof of accepted lifetime cleanup: existing P1 immutable DELETE
guards can refuse cascades. No guard relaxation is proposed; deletion/restore and
all-writer lifecycle fences remain required separately.

Still required: genuine add-class/level/subclass/remove/reorder producer/compiler,
confirmation end-to-end, equipment atomic composition, copy lineage/bootstrap,
campaign create/membership lifecycle, protected full graph writers/order/restore/
Auth/recovery native gates, C2 save/concentration/print and useful NEW private class
authoring. App direct create/equipment/copy stays untouched/default behavior; this
disabled source proposal does NOT repair live creation or complete M4/M6.
