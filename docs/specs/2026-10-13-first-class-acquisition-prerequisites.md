# First-class acquisition prerequisites — fixed710c3fc, PLAN ONLY

Sole writer m5-campaign-monster-worker; approved bootstrap source4694/tested handoff
ac67, receipts and all existing source remain frozen. No source/tests/runtime edits
or Node/npm/network/SQL/engine/build/browser commands. This is a narrow prerequisite
proposal for original R09 + M1 challenge, not a first-class issuer, featureless class,
new authoring flow, live fix or inferred legacy lineage.

## Fixed evidence

| Fixed710c3fc dependency | Git blob | Actual relevant contract |
| --- | --- | --- |
| lib/character/class-origin-command-schema.ts | d935b7c1bb14dedce381499ab3f21abb50efa96a | add_class already exists with exact class/subclass tuples and both expected revisions. |
| supabase/staged/class-origin-producer.sql | 3e39a6c96e638aea87e39ee9fbd34f915a20758d | Immutable pre-DML expected_graph; protected private occurrence/header/receipt rows; full final graph and generic transition counters. |
| supabase/staged/class-origin-joint-revision.sql | d07ce2f53b0af06950ae3eb46006906e804701ed | ONLY metadata_only_confirm event; consumption/finalizer presently force that mode. |
| supabase/staged/class-origin-fresh-bootstrap.sql | e0e86688e7d75a392e40edd94165b0445ca41f1d | Real empty new provenance/native initial0, ALWAYS denied Auth/admission. |
| supabase/staged/hit-die-authority-and-writers.sql | 7f8650efc96617063cf03e6ea4c5763f684ce72c | Ordinary watched fields assign OLD+1; order rebind changes revision only; narrow original authority rights. |
| supabase/migrations/20260720185127_feature_grant_integrity.sql | 57aeceb8b06aa0dd13a597e3e24747991ef58a73 | Current feature materializer DELETE/recreates grants with native default IDs; exact owner snapshot access. |
| supabase/migrations/20260720185149_feature_spell_grants.sql | 2c1a957971b0b677e48d3303c0ea99c4285b482d | Spell materializer does likewise; separate auth.uid-based active spell projection. |
| supabase/migrations/20260720185305_character_content_boundary_guards.sql | 7a99c4e92fbb3005f13c7fd2052e6d06a96017b5 | Public sync_character_feature_refs derives active frozen grants, allocates derived ref IDs, depends on auth.uid. |

Current class-step-client.tsx:handleSelectClass (:206) separately updates choices/
level, inserts class pin, optionally subclass pin, then refreshes. Browser helpers
character-client.ts:updateCharacterAndReturn (:71) and content-refs-client.ts:
insertContentRef (:22) are direct writes without shared/class CAS, protected occurrence
or atomic receipt. feature-refs-server.ts:syncClassFeatureRefs calls the separate
public reconciliation RPC. These flows cannot be adopted as genuine class history.

## Already-supported request and later issuer result

No new request schema is needed for FIRST add_class: contract_version1, character_id,
operation_id, expected_action_revision and expected_class_revision decimal BIGINT
strings, command:add_class, fields{content_id,content_version,subclass:null|exact tuple}.
There is no caller slug, occurrence/ref/grant ID, actor, time, level or graph authority.
Initial acquisition is level1, matching actual selection behavior, never an assumed
accepted character-level1 origin. Narrow future first slice may require subclass:null;
subclass attachment remains required later, not silently discarded from the request.

For the smallest future issuer, require a GENUINE untouched empty new-character
bootstrap receipt/journal/proofs, owned parent/shared revision0, draft header/class
revision0 and producer order0 with actual empty domains. Refuse old refs, reconstructed
bootstrap, a copied/legacy marker or a draft changed by unclosed writers. This is a
finite source prerequisite, not a usable restriction on the eventual builder:
ability/race/background-first drafts and all subsequent changes still need adapters
before live cutover. The receipt FIRST replay prefix must bypass these NEW restrictions.

The fixed bootstrap graph is precisely parent choices/base_stats/state/narrative/
narrative_rich {}, parent action_revision "0", draft new_character origin with its
original creation_operation_id and command_revision "0", no role_proof/origin ID,
producer_version1/order revision "0" and five empty ordered domains: pins, inventory,
spells, feature_grants, spell_grants. Its retained occurrences/refs/inventory/spells/
feature_grants/spell_grants/versions arrays are empty. The original bootstrap journal
has before_parent/before_origin NULL, native preinsert absence and two consumed row
proofs (origin and creation_receipt), finalized without revision-transition consumption.
Require exact saved receipt/journal/proof correspondence, not merely these empty values.

Later actual acquisition allocates a native occurrence and controller ref. Occurrence
binds exact content/version/system/slug/controller identity, selected_at native time,
lifecycle:provisional, acquired_character_level/acquisition_operation_id/accepted_at/
ended_at NULL; subclass_ref_id NULL in the first slice. Saved choices contain that
occurrence_id with exact slug/level1; header remains draft, no origin ID/role_proof
or confirmation. It advances class command revision once and ordinary shared revision
once, emits existing strict normal class receipt with confirmation:null, not bootstrap
or metadata confirmation. Origin identity is NOT sealed by this first selection.

## Concrete blockers; no source-ready positive issuer today

1. The ordinary R09 trigger genuinely assigns OLD+1 when choices change, but P1 joint
   class_origin_acceptance_guard_v1's false→true revision consumption unconditionally
   calls class_origin_observed_revision_v1; class_origin_finalize_transition_v1
   unconditionally calls class_origin_assert_metadata_revision_v1. Both require
   metadata_delta's confirm_origin and the event CHECK(metadata_only_confirm). A
   choices-changing add_class cannot validly close that protocol. Header's joint
   AFTER dispatch only handles draft→recorded, so draft→draft must not borrow it.
2. P1 expected_graph is immutable at acceptance INSERT BEFORE mutations. Ref INSERT
   invokes native materializers, which DELETE/recreate grant rows with default UUIDs
   and now() timestamps. Active derived refs (and active auto-spell rows) allocate
   more IDs in later reconciliation. Those future IDs cannot be inserted into the
   immutable expected graph after the fact. Predicting UUIDs, mutating IDs afterwards,
   omitting grants or using a caller/test graph is invalid.
3. Authority currently has parent UPDATE(state,action_revision), not choices/level;
   class owner has only UPDATE(id) lock visibility, never general parent mutation.
   Neither approved class protocol has ref INSERT or order-domain array UPDATE.
   Bootstrap order INSERT is independently ALWAYS denied and cannot fill changed
   domains. Existing public sync RPCs require auth.uid; they are not verified-context
   private issuers. All those writer/owner/permission/lock adaptations remain absent.
4. Existing materializer/ref reconciliation functions are SECURITY DEFINER with
   empty search_path, but their migration source does NOT specify ALTER FUNCTION
   OWNER TO an isolated staged role. Actual native owner OIDs/privileges are UNKNOWN
   until G2 freezes them. Do not label them authority-owned/postgres-owned by guess,
   transfer them, or grant an observed arbitrary owner access to new private plans.

## Smallest implementable prerequisite source child A

Propose ONLY NEW supabase/staged/class-origin-first-acquisition-prerequisites.sql
after unchanged bootstrap, plus one bounded source-contract test and handoff after
this plan is reviewed. One source writer; original class/R09 owners review both
object families. No materializer replacement, actual choices writer/ref INSERT,
public issuer, app integration, authoring/compiler or generic new calculator in A.

A defines a separate strict ordinary-choice observation contract, not a broader
metadata_only_confirm mode or alteration of that event table. NEW internal
private.class_first_acquisition_proofs_v1 is keyed by existing P1 acceptance UUID
and original current xid/target/actor/operation, with unique transaction/target.
It binds exact actual before_parent/before_order and immutable expected after graph,
initial revision0→1, and a protected planned-row identity envelope; phases pending/
assigned/observed retain actual parent RETURNING/current parent/order readback.
No bootstrap/no-before variant, copied counters, receipt rewrite or reseal.

Planning/allocation inputs are service-internal protected facts, not request fields.
Store the exact preallocated native UUID/time FULL rows and their original immutable
dependency tuples; no later allocation map rewrite. Bounds reuse P1 graph4MiB,
request32KiB and domain4096/transition1024 caps; the combined new phase envelope is
8MiB, explicit before+after payload validation, not a transport guarantee. No truncation,
unbounded discovery or absence inferred from a partial read.

Exact NEW functional seams proposed in A, all SECURITY DEFINER/empty qualified path.
"Class owner" is inkborne_class_origin_owner; "authority owner" is
inkborne_hit_die_authority_owner, both existing isolated NOLOGIN/NOBYPASSRLS roles:

- Class owner: class_first_acquisition_inputs_v1(uuid) RETURNS jsonb derives actual
  P1 journal/bootstrap provenance and exact operation graph. Canonical/native identity
  producer and materializer linkage are missing: this seam independently raises
  first_acquisition_prerequisite_unavailable, regardless of a forged journal.
- Authority owner: observe_first_class_choices_revision_v1(p_context jsonb,p_acceptance uuid) RETURNS jsonb
  has unchanged native verified-Auth/exclusive guard/current-owned-parent prefix;
  accepts ONLY a genuinely changed saved classes delta and actual OLD+1/current
  order revision, never updates a caller counter. It obtains protected inputs ONLY
  via the class seam. It independently refuses first_acquisition_prerequisite_unavailable
  while the genuine choices updater/row-plan bridge is absent, even if a stored parent
  happens to equal expected_after. Current row equality is NOT proof an authorized
  UPDATE occurred. Its jsonb parameter is native-context input to the unchanged denied
  Auth seam, never caller RETURNING/old-row authority. Future B must couple the actual
  guarded updater's typed OLD/RETURNING rows to assigned→observed within the same
  protected transaction; simply calling this observer after arbitrary DML is forbidden.
- Class owner: assert_first_class_choices_revision_v1(uuid) RETURNS void and
  consume_first_class_choices_revision_v1(uuid) RETURNS void require final actual
  observed proof + full raw graph/parent/order matching immutable journal, receipt,
  exact occurrence/controller/derived-row identities and current xid. Consume the
  existing revision_transition_consumed bit only once, after observation, never
  set it on the assumption that an UPDATE was attempted. Inputs remain unavailable.

New table stays owned by the installation owner already owning the frozen private
tables (NOT either runtime role; freeze that exact owner in installation preflight).
Columns: acceptance_id uuid PK/FK to class_writer_acceptance_v1 (immediate FK; this
is normal existing-parent work), transaction_id xid8, target_character_id uuid FK
to characters, verified_actor_id uuid, operation_id uuid, mode fixed
first_add_class_choices, before_action_revision bigint=0, after_action_revision
bigint=1, before_class_revision bigint=0, after_class_revision bigint=1,
before_parent/before_order/expected_after_graph/planned_rows jsonb NOT NULL,
phase pending|assigned|observed, observed_parent/observed_order nullable jsonb.
Unique(transaction_id,target_character_id); non-null types/correlation/full raw
budget and immutable identity fields are checked independently. No new receipt table.

Exact proposed A ACL additions: authority SELECT,INSERT and UPDATE(phase,
observed_parent,observed_order) on ONLY that new table; class SELECT only. SELECT
policies permit these isolated roles to inspect evidence; restrictive INSERT/UPDATE
WITH CHECK(false) and an independently denied authority-owned immediate guard keep
all proof issuance unavailable. No DELETE, TRUNCATE or identity-column UPDATE. All
caller roles (PUBLIC/anon/authenticated/service_role) are revoked. New class-owned
deferred proof closure calls its own assert helper, so no cross-owner finalizer grant.
Exactly two new helper EXECUTE pairs: class inputs(uuid)→authority, authority
observe(jsonb,uuid)→class. Class assert/consume stay class-internal, not granted to
authority or callers. No class public-table DML or authority private-journal
SELECT/DML. No new roles/membership/schema CREATE/Auth/gate/readiness mutation;
self-consistent planned rows or owner identity never authenticate a writer.

Installation order is one additive transaction after the unchanged frozen stages:
owner/helper/type/body/trigger preflight; new table/checks/FKs/revokes/policies;
class inputs; authority observer and immediate guard; class assertion/consumer and
deferred closure; actual two existing class function replacements; new immediate/
deferred triggers; exact two EXECUTE pairs/table ACL closure. No forward dependency
assumption. Every NEW input/observer/INSERT/phase path independently refuses while
Auth/class gate/readiness are false, including direct isolated-owner calls.

A adds strict routing to the TWO existing class-owned acceptance/finalizer objects
through additive CREATE OR REPLACE AFTER helpers exist: add_class routes to the new
ordinary assertion, confirm_origin keeps exact original metadata assertion. All
other commands remain unavailable, no default permissive branch. Base source files
and R09 ordinary BEFORE/AFTER revision functions remain byte-unchanged. All original
private row-proof/RI/receipt/counter/finalized/deferred checks are preserved. Any exact
helper signature/dispatch correction must be re-challenged before implementation.
Preserve actual existing modes: class_origin_acceptance_guard_v1() remains SECURITY
DEFINER; class_origin_finalize_transition_v1(uuid) remains SECURITY INVOKER with
its original class owner and empty qualified search_path. Do not promote the latter
to definer, broaden original EXECUTE, or replace bootstrap dispatch/finalizer.

This does NOT authorize a positive event issuer or demonstrate add_class: canonical
protected planning/materializers/actual choices writer are absent. The source child
is actual SQL storage/observation/closure behind refusal, not a disconnected model.
No new UI status as a substitute for gameplay. Future installed-object profiles must
freeze final ordered replacement bodies/owners/configs; original bootstrap preflight
hashes are not silently edited to tolerate an unknown later object replacement.

## Required B: native row identity, materializers and order before add_class issuer

Before any positive A inputs, separately freeze native old materializer owners and
DDL/trigger/role capabilities through G2; source may retain existing object owners
with no transfer, but cannot guess new cross-family EXECUTE/table grants. Coordinate
R09 full source/count/permission/lock union and spell closure owner before changing
those functions. Old unplanned materialization stays outside the approved protocol;
all-writer fences are mandatory for cutover, no privileged bypass inferred from it.

The smallest reliable long-term row-identity mechanism is a protected CURRENT-xid
native plan for a NEW controller, not preservation by renaming generated grants:

1. Native Auth/owner/guard + original class command receipt replay FIRST, before NEW
   bootstrap/source/revision/counter gates. Equality expiry denies after waits and
   immediately before return; prior receipt actor/time/raw pins stay original.
2. For NEW work, lock actual owned parent/header/order and stabilize native source
   union. Controller must be exact same-system readable immutable class version and
   current definition identity, published system; first null-campaign slice admits
   platform or current actor-owned personal snapshots/current definitions only.
   Recheck acquisition permission/retirement/version identity after waits. Existing
   character_can_access_content_version is auth-independent owner entitlement, not
   actor/session verification or a full current-definition/lock certificate.
3. Resolve the entire immutable controller feature/spell manifest using existing
   actual helper semantics, exact historical cutoff, owner preference/version rules,
   and canonical class/content parsing. Missing, malformed, unsupported or ambiguous
   dependency resolution stays unavailable, no current-latest replacement. Raw
   arrays/effects/absence and declared level order are retained. Canonical SQL/source
   admission remains a missing prerequisite, not a caller boolean/parsed DTO claim.
4. Allocate genuine DB IDs/time BEFORE acceptance for new controller, occurrence,
   unique controller+feature_slug grants, unique controller+spell_slug grants and
   active derived refs/auto-spell projections. Full expected graph and row plan are
   internally derived and immutable before DML. IDs are native random values, never
   deterministic fixture IDs or guessed future trigger output. Initial first scope
   cannot hide nonempty features/spells to produce a featureless pseudo-issuer.
5. Materializers need a narrow, reviewed NEW-controller branch consuming that exact
   plan under matching current xid/acceptance/target/controller proof. Its INSERTs
   must use planned native IDs/rows, observe actual RETURNING, and preserve real FK/
   entitlement/active filtering. No DELETE/recreate of preexisting controller grants
   in this first operation, no GUC/flag/role-only skip of existing checks. A mismatched
   generated row or unexpected trigger side effect aborts, not repairs expected_graph.
6. Genuine parent choices UPDATE must be performed by an R09-owned guarded helper
   with narrowly reviewed choices/level privileges; ordinary trigger assigns OLD+1.
   Read actual RETURNING + current parent/order after waits. Revision-only rebind
   is not domain completeness: append/rebind approved controller/derived/grant IDs
   only after actual materializer/reconciler completion and exact full-table ID
   bijections. Preserve inherited domain order; first order must follow authoritative
   source traversal/planned insert order, never UUID/timestamp/query order inference.
7. Private active derived-ref reconciliation must use native verified owner and
   persisted class choices, not borrow public auth.uid RPC semantics. Original
   feature refs use exact grant IDs/version/context and auto:feature-grant:<id>.
   Native automatic spell rows require their separately coordinated spell-grant
   representative/provenance/count writer, also planned IDs if emitted. If unsupported,
   NEW class acquisition refuses; it cannot silently omit spell grants/projections.
8. Final complete actual graph/order/rows close the ordinary observed proof; only
   then consume once, class header draft revision0→1 and exact normal class receipt
   close P1/deferred finalizer. Header remains draft/provisional. No manual bump,
   metadata-confirm event, synthetic before0, bootstrap fusion or automatic primary.

Known capabilities needed in B/later issuer, NOT granted by A: guarded R09 parent
UPDATE(choices,level); controller/derived ref INSERT; exact new native grant/projection
row participation under original writers; order-domain UPDATE for actually changed
pins/feature_grants/spell_grants/spells as applicable. Inventory is preserved, no
inventory writer required by ordinary class selection itself. Class owner retains
private occurrence/header/class-receipt/journal/proof rights but gets no broad public
DML. No privileges/readiness rows are added now; exact policies/grants require a new
finite owner challenge once native materializer identity is known.

Source traversal positions can determine projection order only. Repeated feature
slug entries are merged by current (controller_ref_id,feature_slug) uniqueness and
LEAST unlock rule; preserve actual helper semantics and refuse unresolved ties.
Those keys/positions are NOT protected earned-feature occurrence/origin identities.
The delete/recreate generation bridge needed by Arcanum remains separately required;
do not derive it from slug/version/time/array position or class occurrence UUID.

## Evidence needed; still blocked for positive use

In A: actual source-bound static negative shows existing unmodified acceptance guard/
finalizer are confirm-only; new mode routing is explicit and metadata bytes semantics
preserved. Bind exact original owners/proconfig/language/return/trigger arguments,
scalar BIGINT bounds, duplicate/current-xid proof denial, direct forged-journal/event
unavailable admission, missing protected inputs, no parent/manual counter mutation,
receipt-FIRST/replay/owner/expiry source controls. No independent transition calculator.

Before B/issuer acceptance, G2 proves native owner/ACL/RLS/lock/trigger ordering and
all independently denied seams; positive operation needs genuine approved native Auth
and closed writer union, not privileged fixture context passing as Auth. Original
nonempty20-level class/feature fixtures must exercise current/future feature grants,
duplicate manifest slug/minimum unlock and supported spell grants/projections,
exact raw version continuity/current retirement refusal, planned/native actual ID
correspondence, corrupted/missing plan/row/extra trigger denial, real ordinary0→1
without metadata bump, double-update/double-consume/order bijection rejection, and
fault rollback at every actual phase/deferred commit. Unknown/missing identities
must refuse. Native receipt replay after later graph/source changes preserves original
pins and never re-acquires/auto-confirms. No UI/mock gate is PostgreSQL authority.

All admissions/Auth remain denied, class gate false/all13 false. Native G2 profile,
original owner inventory, planned materializers, first add_class issuer, subsequent
editable draft/level/subclass/remove/reorder/copy/restore/all-writer fences and C2
save/concentration/print remain required. This doc authorizes none of their execution
and does not mark first acquisition, NEW private class authoring or M4/M6 complete.
