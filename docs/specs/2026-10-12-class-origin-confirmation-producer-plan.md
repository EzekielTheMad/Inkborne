# R06/R12 P1b.2 — private already-first confirmation producer

2026-10-12, PLAN ONLY, sole class-origin worker on codex/r12-passive-features,
clean basis22d826e22e32c2e3b950291dc6f170d300372a0b. Two documentation files only.
P1a and P1b.1 are accepted LOCAL source/models, not PostgreSQL/Auth/producer
acceptance. P1b.1 gate receipt covers194 tests/typecheck/lint on760101b, with model-only
27bb identity failures preserved. Both frozen bases and joint stage remain unchanged.

## Smallest real transaction source child

NEW `supabase/staged/class-origin-confirmation-producer.sql`, loaded AFTER the
unchanged R09 authority, P1a and joint stages. One source writer; original class and
R09 authority owner families independently review. No migration, SQL execution,
public function/API, app import, old begin replacement, readiness or Auth widening.

Entry: `private.confirm_already_first_class_origin_v1(p_verified_context jsonb,
p_intent jsonb) RETURNS jsonb`, VOLATILE SECURITY DEFINER, original
inkborne_class_origin_owner, fixed empty search_path. Actual SQL body derives and
writes the protected acceptance/proofs/metadata/receipt, rather than accepting a
caller-planned graph or merely offering another calculator.

Supported NEW work: explicit confirmation of an existing already-first provisional
class on a genuine new_character draft. Current selected level may be1 or higher;
other classes may exist. No reorder, HP/state mutation, source acquisition/repin,
class/ref insertion, source compilation or public materializer call. Fresh-draft
copies, recorded/ended copies and legacy characters remain unavailable for NEW
confirmation until their separate actual producers/lineage contracts are accepted.
Already-committed receipt replay precedes these NEW-work restrictions.

Source-only function still begins with unchanged require_class_origin_auth_v1,
which UNCONDITIONALLY raises auth_unavailable. Its current RETURNS void is not an
actor resolver. No verified actor exists today, and no statement below that call
is reachable through an accepted production Auth path. Only a separately accepted
native same-token user/session/config verifier may establish context.actor_id as
authority later. Shape/UUID/getUser/service role/current_user/GUC/owning a function
cannot do so. Keep both class/R09 Auth seams denied during this child; do not add a
boolean or substitute UUID-based Auth to exercise a positive source path.

## Actual predecessor paths and required evidence

| Existing source/function | Why it cannot supply this child's authority |
| --- | --- |
| `app/(app)/characters/new/actions.ts:createCharacter`; `lib/supabase/characters.ts:createCharacter` | Direct parent INSERT and redirect to editable builder. No private draft, creation receipt, occurrence or proved order. getUser is not the native verified-context contract. |
| `supabase/staged/starting-equipment-transaction.sql:create_character_with_starting_grant` | Published-system parent INSERT plus eligible equipment marker; caller actor UUID/service boundary. No origin/bootstrap receipt/order. Equipment completion does not elect an origin. |
| `app/(app)/characters/[id]/builder/class/class-step-client.tsx:handleSelectClass` | Whole choices/level save then exact class/subclass ref in separate requests. New classes contain slug/level/subclass, not occurrence_id. First click is provisional intent, never seal. |
| Same file level/remove/subclass handlers; `lib/supabase/content-refs{,-client}.ts` | Independent direct writes/reparent/removal/reconciliation. They are not a trusted class occurrence producer or a writer fence. |
| `lib/types/character.ts:CharacterChoices.classes` | No persisted occurrence ID currently. Do not infer one from slug, array position, pin ID, timestamp or restore. |
| R09 `read_locked_hit_die_graph_v1` | Checks all13 readiness families first; cannot be used as a positive input reader by bypassing that gate. |
| P1a `class_origin_read_final_graph_v1` | Reusable full raw graph/ordered-domain/version bijections from an already-real header/order; lacks complete child/source locks, Auth/acquisition check, and canonical mechanical-schema admission. |
| Joint stage `class_origin_metadata_delta_v1` / AFTER origin dispatch | Actual *after* metadata validator and one-bump machinery. It does not derive before graph, issue command/row proofs, create provisional occurrences or authorize source acquisition. |

Genuine creation proof for NEW work must correlate ALL retained records:

- Draft header: creation_provenance=new_character, nonnull creation_operation_id,
  source_draft_operation_id=NULL, origin_occurrence_id=NULL, role_proof=NULL and
  same system/current target. No header repair/bootstrap from legacy data.
- Existing `character_creation_commands_v1`: exact target/creation operation and
  original creator equals current verified owner for NEW work; receipt_kind=bootstrap_new,
  create_character intent, original system, all three initial counters0, copy_lineage=NULL.
  Original name/campaign may legitimately differ after later edits; compare them with
  original bootstrap journal, never demand today's mutable name equal the old name.
- Existing finalized bootstrap_new acceptance in its original transaction: same
  receipt/target/creator, genuine captured preinsert proof, absent before fields,
  complete creation/origin INSERT row proofs consumed, original empty draft/ref graph
  and original0/0/order0. Do not use today's counter0 as an absence proof or re-run
  that historical finalizer against today's changed graph.
- Selected current provisional occurrence needs prior retained finalized add_class
  acceptance/receipt and its consumed occurrence INSERT proof (before NULL). Match
  current immutable id/character/system/content/version/slug/selected_at/controller
  pin with that exact insertion, not a slug-only receipt. Mutable level/subclass is
  read from today's graph. Existing strict add_class receipts do not contain a new
  occurrence result field; identify it through their actual retained insertion proof.
  No private add_class producer/accepted writer exists yet: this is an explicit
  dependency, not permission to synthesize that journal from current rows.

Current full source/schema and native producer validity of those historical records
remain later G2/producer gates. Mere JSON equality, internal role or an injected
fixture is not historical authorization. Restores missing any linkage are unavailable.

## Request, replay and bounded source contracts

Accept exactly existing contract_version1 confirm_origin intent: character_id,
operation_id, expected_action_revision, expected_class_revision, fields exactly
selected_occurrence_id. Canonical decimal bigint0..9223372036854775807; no Number
conversion. Intent<=32KiB UTF8, unknown fields refuse. No actor, graph, clock, receipt,
source tuple, desired counter/HP/order, grant/classification or fresh flag input.

After native Auth (currently denied), shared guard FOR UPDATE and current owned
parent lock waits, recheck native current-owner/session/Auth context against the
locked parent and current native time. Then lookup command by target/operation
BEFORE ALL NEW-work origin/occurrence/history/source locks and gates. Immediately
before returning any matching receipt, recheck that native current-owner/session/
Auth context remains valid and native expiry is strictly later than clock_timestamp();
equality is expired. No pre-wait Auth result or browser time can authorize replay. Match
stored canonical intent exactly (JSON object key order immaterial; arrays significant).
Same operation/changed intent conflicts; same operation/matching intent returns the
ORIGINAL immutable receipt and status=replayed. Current ownership/session is required;
receipt actor/time/revisions are not rewritten to today's owner or counters. Replay
does not require today's live source permission, retirement status, draft header,
nonexhausted counters or active origin. Actual ownership/lifecycle acceptance is
still G2; NEW work with creator/current-owner mismatch is unavailable in this child.

NEW work checks shared AND class revisions, draft history above, selected first
occurrence/pin, total selected levels1..20/unique slugs/occurrences, forward+reverse
class/subclass bindings, complete before graph/order and finite bounds. Exhaustion
refuses NEW mutation but not prior replay. Different operation trying to reseal a
recorded/ended origin refuses; it is not an unchanged reseal or a new election.

Full raw before/after graph limit4MiB per existing P1a storage, existing domain
<=4096 IDs and <=1024 transitions; producer emits EXACTLY3 transitions. Retained
occurrences<=256, active<=20. Existing joint event aggregate8MiB still applies.
No truncation, guessed defaults or source pagination. Overflow refuses atomically.

## Exact source and acquisition rules

Separate **acquisition tuples** (selected starting class plus its selected subclass,
if present) from **retained tuples** (ALL refs/inventory/spells/feature grants/spell
grants/retained occurrences, including ended/inactive history). Every retained tuple
must have exactly one complete same-system immutable version and current definition
identity: content ID/system/type/slug; no extra/missing version, latest substitution
or hidden bad row. Preserve entire data/effects/source/scope/owner/time snapshots.

For NEW confirmation acquisition tuples require BOTH immutable snapshot entitlement
AND current definition entitlement after waits, with current definition is_retired=false:

- Platform scope is usable; or owner equals the verified actor; or shared scope with
  an exact share in THIS character campaign and that actor is actual campaign owner
  OR current member. Require campaign/system equality. Shared catalog visibility in
  another campaign, public character viewing and linked-version fallback are insufficient.
- Apply this independently to version.scope_snapshot/owner_id_snapshot and current
  definition.scope/owner_id. Current data/effects/version number are NOT substituted
  for the pinned version. Catalog v2 with legitimate continuing entitlement retains v1.
- Retirement blocks NEW confirmation of that selected source; it does not block
  immutable receipt replay or discard retained historical versions. Ended/inactive
  nonacquisition tuples use historical continuity, not fresh acquisition permission;
  their retirement/share revocation cannot silently delete raw history or grants.

Existing `private.can_use_content_version` uses auth.uid and cannot authenticate
this service-context producer. `character_can_access_content_version` has different
member-only semantics; equipment's starting_grant_can_use_version takes a bare actor
and is not an Auth prefix. Do not call either as a trusted shortcut or alter them.
The new helper derives current actor only after unchanged denied/native-verifier seam
and evaluates the explicit owner/member/snapshot/current rules above under locks.

Canonical envelope/raw graph closure is distinct from class/effect mechanics admission.
The metadata-only producer does not evaluate or certify arbitrary class formulas,
save grants, spellcasting or feature effects. Original test sources must pass actual
class/effect parsers; source/model tests do not prove runtime canonical admission.
Actual add_class/compiler must establish canonical immutable source admission/indexed
raw manifests before mechanical availability; no invented manifest keys/attestation
or legacy save_ rewrite is added here. C1/C2 still refuse unproved mechanics.

## Lock prefix and minimum actual privilege changes

Reuse exact existing lock_character_writer_guard_v1() FOR UPDATE. After future Auth,
lock current owned parent FOR UPDATE, recheck native current-owner/session/Auth
and expiry after those waits, then lookup/recheck replay as specified above. Only
NEW work locks private origin/all retained occurrences by stable UUID, selected
bootstrap/add-class receipt/journal records and sources. New authority-owned source
helper uses existing R09 stable public prefix: definitions UUID, system, campaign, members UUID, shares
UUID, versions(content_id,version), then refs/inventory/spells/feature grants/spell
grants each by UUID and existing projection order. Preserve semantic arrays separately.
Re-read/count/project ALL rows after waits; no pre-lock callback plan is accepted.

Existing R09 owner has SELECT plus key-lock UPDATE privileges/policies for definitions,
system/campaign/members/shares/versions, and order producer_revision UPDATE. It has
SELECT ONLY on the five child domains, so SELECT FOR SHARE there cannot be assumed.
This plan explicitly proposes authority-owner-only UPDATE(id) on those five tables,
new permissive UPDATE USING(true)/WITH CHECK(false) lock policy plus AS RESTRICTIVE
UPDATE WITH CHECK(false) per table. No actual child mutation or caller privilege.
No class-role public-source UPDATE grant. Existing R09 state/action-revision writes
and order-rebind rights are unchanged. Later real child writers cannot reuse these
restrictive lock-only policies without their separately reviewed role/ACL redesign.

These locks protect this transaction's existing rows. They are NOT persisted writer
fences or proof against unclosed phantom/new-identity/admin/restore writers. Parent
FK/RI behavior, actual conflicting locks, repeatable closure and provider roles need
G2. Deferred full graph checks must reject observed late drift, but cannot be advertised
as complete cutover/concurrency proof while nonparticipating writers still exist.

## Actual transaction derivation and write sequence

1. Auth/shared-guard/owned-parent waits, native current-owner/session/Auth recheck,
   receipt lookup and immediate pre-return native expiry recheck (equality expired)
   as above. Replay takes no NEW-work origin/occurrence/history/source locks. Only
   NEW work then locks private history and validates intent/revisions/provenance.
2. Class-owned private-input helper derives retained occurrence IDs/tuples and selected
   provenance from actual stored private rows. Authority helper independently uses
   that helper; never receives caller-asserted tuple arrays. Lock all source/access/
   child/order rows with the exact minimum privileges above, then recheck permission,
   ownership/system and immutable source closure after waits.
3. Internally derive full before graph using existing class_origin_read_final_graph_v1
   and complete internally derived retained-ID bijection (stable UUID order for retained
   metadata only; do not reorder choices/pins/effects). Native before validation repeats
   forward/reverse selected class/subclass/pin bindings, required system/version closure
   and exact historical records. No marker has been issued yet on a refusal.
4. Native acceptance clock_timestamp immediately before protected issuance/mutation;
   future native Auth/session expiry is rechecked then, equality expired. No browser
   time. Create typed occurrence/header after-row values from actual before rows:
   selected provisional→accepted/acquired1/current operation/time; header draft→recorded,
   selected ID/confirmation role proof/class+1. Preserve immutable identity/creation,
   arbitrary extensions and all unrelated raw graph bytes. Parent changes ONLY revision;
   order changes ONLY producer_revision through existing R09 AFTER trigger.
5. Derive strict class_transition receipt, original C1 confirmation subreceipt, expected
   graph and exactly3 immutable row proofs entirely from those current native rows/time.
   Canonical native time correspondence uses the existing validated native instant
   contract; raw row timestamps and receipt cannot disagree or lose microseconds.
6. Insert DB-generated acceptance UUID/current xid/before rows/expected graph/receipt,
   then unused exact row proofs. Existing immediate guards verify actual before rows.
   Update occurrence FIRST, origin SECOND. The existing joint AFTER dispatch performs
   the SOLE action revision bump, original order rebind, RETURNING/stored observation
   and checked Boolean consumption. Producer does not UPDATE public.characters itself.
7. Insert actual immutable class receipt through its exact unused proof, set finalized,
   invoke existing class_origin_finalize_acceptance_v1. Original P1a deferred callbacks
   and joint observed-event closure remain armed. Return applied receipt; commit faults
   propagate with no catch/fallback/partial success or retry under a different operation.

## Concrete stage definition, ownership and grant order

One entire new file, same sole class-origin worker; original R09 reviewer read-only.
Both approved bases/joint source and old begin function remain byte-identical.

1. BEGIN, exact prerequisite function/table/owner/false-gate manifest checks. No new
   table/role. Install the five explicitly named authority child-key lock grants and
   paired policies first; caller ACLs unchanged.
2. Define class-owned `private.class_confirmation_private_inputs_v1(p_character_id uuid,
   p_selected_occurrence_id uuid) RETURNS jsonb`, VOLATILE SECURITY DEFINER, empty
   search_path. Bounded actual private source/creation/selection evidence only; it
   does not authenticate/issue markers or synthesize missing history. Grant EXECUTE
   ONLY to authority owner for its internal re-read; owner itself can invoke it.
3. Define authority-owned `private.lock_class_confirmation_sources_v1(p_verified_context
   jsonb,p_character_id uuid,p_selected_occurrence_id uuid) RETURNS jsonb`, VOLATILE
   SECURITY DEFINER, empty search_path. Requires unchanged native denied Auth seam,
   existing guard/current owned parent; calls step2 and locks/rechecks exact sources/
   permissions/order. Grant EXECUTE ONLY to class owner. No authority journal DML grant.
4. Define class-owned `private.validate_class_confirmation_before_v1(p_graph jsonb,
   p_private_inputs jsonb,p_intent jsonb) RETURNS void`, VOLATILE, empty search_path.
   Inputs come ONLY from step2/3/current graph reader. Finite native identity/provenance/
   bounds/forward+reverse checks, not a mechanical evaluator or caller graph admission.
5. Define class-owned private confirmation entry AFTER those dependencies. It calls
   unchanged denied class Auth, receipt-first path and steps2–4, derives the real write
   sequence above. No issuer or compatibility wrapper replaces old begin.
6. Reassert owners, revoke PUBLIC/anon/authenticated/service_role EXECUTE on every new
   signature in same transaction; exact internal bridges only. No grants to old base
   dispatch needed (entry/class finalizers share owner), no authority grant to class
   journal, no new readiness/Auth/event/old RPC/role-membership/CREATE permission.
   COMMIT. G2 later proves effective grants/policies/owners, not source text assumptions.

Further touchset after independent challenge: new producer strict result schema/model
only as necessary, original source-bound fixtures and focused native-source/model tests,
handoff. No app/provider/form/R09/P1a/joint edits or new dependencies. Models compose
existing P1/joint closure and trace ACTUAL new reader/access/producer functions.

## Finite tests, before controls and stopping point

Prepared source/model positives: actual internally observed bootstrap/add-class history,
canonical original class/pins, level1/higher/already-first multiclass, exact3 proofs,
one shared/class/order step and preserved unrelated arrays/raw snapshot/HP. Stored
receipt replay bypasses changed retirement/share/version/current counters and emits
zero new acceptance/event; changed intent conflicts. Source-bound trace controls
must prove receipt return precedes every NEW-work origin/occurrence/history/source
lock or reader: even unavailable NEW history returns the original receipt under a
still-valid native current-owner/session context, without receipt actor/time/revision
rewrites. No fixture Auth boolean turns
the unchanged entry into authenticated success; model positives are model_checked only.

Negatives: native session/Auth expiry or current-owner invalidation during guard/
parent waits refuses even a matching committed receipt, including expiry equal to
the immediate pre-return native instant; expiry after lookup but before return also
refuses. These are source-bound semantic controls with valid pre-wait context and
otherwise replayable receipts, not the unconditional unavailable-Auth constructor.
Other negatives: bare actor/getUser/shape/service context; legacy/equipment-only header or
array-derived occurrence; foreign/missing creation receipt, wrong original0 bootstrap,
missing retained insertion proof/add-class receipt, wrong source/control pin/subclass
parent, ambiguous/extra sources, foreign system, missing order/version, stale revisions,
overflow, current scope/share/member/retirement revocation after wait, changed returned
snapshot, native expiry equality, false/unused/reused proof, bad row actor/target,
partial receipt/finalization and late graph/order mutation. Selfconsistent expected/
observed forged history must refuse its specific invariant, not generic mismatch.

Static critical-body removal/order/ACL tests are separate from meaningful semantic
before controls. Before uses coherent unchanged original direct-create/class-select
outputs lacking actual private provenance or original marker stub that cannot derive
a native acceptance; successful construction/ordinary controls precede the specific
unsafe-history/receipt/access invariant. Do not count a missing function/constructor/
collection/Auth-unavailable exception as SQL atomicity or semantic repair evidence.

Narrow package tests maxWorkers2/typecheck/lint only after root release and source
review; actual SQL syntax/roles/RLS/trigger/native time/rollback/replay/concurrency
requires separately authorized disposable G2. No SQL/PGlite/native transaction has
run for this plan. Independent plan challenge precedes any implementation.

Fresh/bootstrap and class add/level/subclass/remove/reorder/order/compiler producer
source are required separate children; this function cannot create their evidence.
Copy/multihop, all materializers/refs/grants/inventory/spells/access/version/lifecycle/
restore writers, native Auth/session/config and final privilege/cutover closure remain
open. All13 readiness false, Auth denied, default-off unchanged. C1v2 and C2 actual
save/concentration/print consumers remain prerequisites before NEW class authoring.
Rollback disables availability while retaining history/counters/fences, never restores
legacy whole-choice writes, resets revisions, reseals origin or deletes uncertain receipts.
