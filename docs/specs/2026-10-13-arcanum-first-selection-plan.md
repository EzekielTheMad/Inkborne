# M6 Arcanum first selection — amended compile-disabled storage/read contract

2026-10-13. Frozen discovery root9f848d4658ac9c523d548d51c0f5a19710de95d8;
immutable first proposalddae9f4a0b6ec806560db89d1c49982860137153 retained in Git.
This amendment addresses m1's three HOLD groups and original R09-owner findings.
ONLY this plan and its handoff change over preserved M5 worker62a source/history.
No implementation/Node/npm/tests/network/SQL/provider/flags/runtime is released.
Exact amended m1 + original R09-owner plan challenge is still required before code.

## Actual evidence and current boundary

- advanced-binding.ts12–34/78–145 is advisory, used only by fixtures/tests. It
  requires original raw snapshots + modeled grant edges and produces payment
  intent, never a saved choice, receipt or authorized cast.
- advanced-descriptor.ts6–33 reads SAME raw feature data_snapshot.advanced_casting:
  kind/arcanum, listClass, spellLevel6–9, selectionCount1, castLevel=spellLevel,
  usages1/recovery"long rest", no contradictory bonus/free/fixed-casting policy.
- Current content-refs.ts22–88/148–163 now includes feature_grant_id and counted
  ASI feature grants; the old Arcanum handoff omission claim is stale. Raw extension
  is still stripped by canonical feature parsing. Ordinary counted RLS reads do
  not prove protected historical compiler/materializer lineage.
- feature_grant_integrity migration20260720185127 lines57/74 cascade controller/
  derived relationships; capture at190 deletes grants, then280 inserts them anew.
  A feature_grant_id is a generation identity, NOT a stable earned occurrence.
- spells-server.ts15–30/76–101 exposes content/version/class active tuples, not
  a chosen advanced binding. Spell-grant migration20260720185149 captures only
  spellcastingExtra. Generic resolved_choices contains slug arrays, no protected
  advanced choice. Current ordinary acquisition-version precedence stays intact.
- CastChoice/dialog/provider support only cantrip/slot/Pact/ritual; current writer
  compares state, not every binding/source/permission dependency. Actual payment
  remains blocked, not repaired by a local model or diagnostic-only UI.
- Frozen R09 authority stage grants only UPDATE(state,action_revision) on characters,
  NOT choices. Its graph/order/count/required-version/source-lock sets do NOT contain
  the new private binding domain. Auth always raises auth_unavailable; all13 readiness
  rows remain false. Existing P1 metadata event is confirm-origin-specific.

## Stable earned occurrence, immutable first choice and v1 copy refusal

Recommend future protected earned_occurrence_id and origin_id, opaque UUIDs issued
and retained by an authorized controller/feature producer. Its bridge must map
EVERY current grant generation + exact controller occurrence/feature ordinal/pin
back to that same earned occurrence/origin, including grant deletion/rematerialization.
The bridge is ABSENT today. Do NOT infer it from matching slug/version/controller
order/level/time, or repurpose starting-class confirmation as advanced entitlement.
An old retained choice plus an unbridged new grant generation MUST be unavailable,
never a new empty selection slot. First choice also requires this proof; no legacy
adoption/current-catalog bootstrap. The proposed UUID request asserts no authority.

NEW private.character_arcanum_selections_v1 stores one immutable FIRST choice per
(character_id,earned_occurrence_id), keyed (character_id,selection_id). Capture:

- schema_version1/capture_kind"first_choice"; selection_id, character_id, system_id;
- earned_occurrence_id, origin_id; original feature_grant_id generation and exact
  controller_ref_id/controller content+version, derived_feature_ref_id/feature
  content+version, feature_slug/unlock_level, selected spell content+version;
- original raw immutable controller/feature/spell envelopes and captured grant tuple;
- original operation_id, original_actor_id, accepted_at native instant, before_revision,
  after_revision; canonical first-select intent. IDs/times/raw identities are nonnull.

NEW private.character_arcanum_selection_receipts_v1 has PK(character_id,operation_id)
and UNIQUE(character_id,selection_id), same complete reciprocal tuple:
character/selection/earned-occurrence/origin/original-grant/controller/feature/spell,
original operation/actor/time/revisions + canonical intent and exact capture readback.
Versions1..2147483647; unlock1..20; revisions native BIGINT with decimal strings on
JSON wire; before<MAX and after=before+1 for proposed future original FIRST choice.
Native six-digit finite UTC acceptance instant, strict8KiB request, aggregate8MiB
raw read/receipt budget (UTF8 checked before TS parse; native octet_length too).
Unknown keys/defaults/array reordering/caller provenance fields are refused.

Freeze reciprocal scalar identity tuple on BOTH rows:
(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,
original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,
controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,
feature_content_id,feature_version,spell_content_id,spell_version).
Use composite UNIQUE on this exact tuple and TWO matching composite FKs,
DEFERRABLE INITIALLY DEFERRED: selection→its original receipt and receipt→its selection.
Raw JSON/text is NOT an indexed FK column. Final commit cannot leave one without
its exact counterpart. Deferred pair-closure triggers compare canonical intent and
the complete captured payload/raw envelopes, not merely scalar IDs. Both rows have character FK
ON DELETE CASCADE; no FK to current grant/ref/catalog that deletes historic choice.
Native delete guard permits ONLY actual character absence under existing privileged
parent visibility; hidden RLS absence/current_user/GUC are not proof. All other
UPDATE/DELETE/reparent/rewrite forbidden. Native cascade/RI/role behavior remains G2.

V1 explicitly REFUSES copy-produced captures or copied pointers: capture_kind accepts
ONLY first_choice and original character is this character. No copy API, copy receipt,
source-ID reuse, imported history or phantom human confirmation. A later versioned
bridge must remap target controller/ref/grant/selection IDs, preserve protected earned
origin across each target lineage, exact source pin/raw content and ROOT first-choice
character/selection/operation/actor/time, separately immediate source IDs/map including
copy-of-copy, and copied feature_uses. It must distinguish inherited capture from an
original human choice. Copy cannot create another free use or reset existing spend.
Existing copy runtime remains unchanged/unavailable for this future advanced feature.

## Selection eligibility, recorded history and cast availability are separate

Do NOT call existing resolveAdvancedBinding as selection admission: it rejects
spent>=1 before returning unselected. That is cast availability, not whether the
human may capture a first choice or read an already captured binding.

Future first-selection eligibility validates descriptor, stable earned bridge,
exact active controller/derived/grant/source relation, list/level/version/class
unlock, permitted acquisition and complete canonical/immutable inputs. A VALID
nonnegative integer spent count0 OR>=1 never prevents reading a valid recorded choice
and does not reset/spend it. First choice with valid exhausted usage may be captured,
but cast availability is exhausted. Absent valid-map own key means0; null/string/
negative/fractional/accessor usage or incomplete/colliding raw resource contributors
refuses current eligibility/availability. Generic deduplication is not collision proof.
Recorded immutable history remains available with explicit current eligibility
unavailable/exhausted; never hide or erase capture, fabricate unused state, or report
it cast-ready. Current model remains unchanged; a separately scoped future eligibility
adapter must split these semantics without changing ordinary resource/rest behavior.
V1 read returns raw counted history plus raw state, NOT a ready/payment boolean.

## Narrow FIRST child — compile-disabled private storage/schema/read seams ONLY

The first implementation after challenge owns ONE new stage and strict DTO/source-
bound tests. It does NOT create a positive issuance, projection or cast capability.
Current R09/P1 bytes and grants remain unchanged. No UPDATE choices grant, public
RPC, app/API/DAL/UI wiring, production parser, migrations, deps, readiness14/marker,
bootstrap/compiler/backfill/copy/replacement or full writer closure is included.

Proposed exact LOCAL definitions in new supabase/staged/arcanum-first-selection.sql:

| Object/signature | Result/body boundary |
| --- | --- |
| private.arcanum_request_shape_v1(p_request jsonb) RETURNS boolean | Closed first_select command_version1/operation_id/expected_revision/earned_occurrence_id/feature_grant_id/spell_content_id/spell_version;8KiB; no actor/raw/usage/role assertions. |
| private.arcanum_capture_shape_v1(p_capture jsonb) RETURNS boolean | Strict first_choice reciprocal captured fields, finite time/revision/raw identity/budget; structural only, not canonical/lineage authority. |
| private.arcanum_receipt_correspondence_v1(p_selection jsonb,p_receipt jsonb) RETURNS boolean | Exact reciprocal full tuple + versioned canonical intent and raw readback; array order significant, no JSONB::text cross-language digest. |
| private.arcanum_canonical_ready_v1(p_character_id uuid) RETURNS boolean | UNCONDITIONAL false; no guessed canonical admission issuer. |
| private.arcanum_lineage_ready_v1(p_character_id uuid) RETURNS boolean | UNCONDITIONAL false; no synthesized occurrence/grant lineage. |
| private.arcanum_order_ready_v1(p_character_id uuid) RETURNS boolean | UNCONDITIONAL false; no appended private-domain locks/order. |
| private.arcanum_prerequisite_refusal_v1(p_character_id uuid) RETURNS jsonb | UNCONDITIONAL {status:unready,reason:canonical_lineage_order_unimplemented}; cannot become positive by changing a caller context/readiness/GUC. |
| private.lock_arcanum_parent_v1(p_verified_context jsonb,p_character_id uuid) RETURNS public.characters | Actual existing Auth/guard/current-owned parent prefix below; no raw UUID-as-Auth or public entry. |
| private.read_locked_arcanum_selection_v1(p_verified_context jsonb,p_character_id uuid) RETURNS jsonb | Prefix; count ALL retained private selection + receipt rows; exact raw pairs/byte bounds/reciprocal closure. {status:read,read_version:1,character_id,system_id,revision,native_read_at,counts,selections,receipts,state,current_eligibility:{status:unavailable,reason:prerequisites_unimplemented}}. Counts/revision decimal strings. No activity/cast readiness or current-source acquisition claim. |
| private.select_arcanum_spell_v1(p_verified_context jsonb,p_character_id uuid,p_request jsonb) RETURNS jsonb | Shape→prefix→matching receipt correspondence/intent replay FIRST→UNCONDITIONAL prerequisite refusal; NO INSERT/UPDATE/DELETE/projection/revision bump branch. |
| private.resolve_arcanum_selection_v1(p_verified_context jsonb,p_character_id uuid,p_operation_id uuid) RETURNS jsonb | Prefix→receipt FIRST; valid reciprocal receipt returns {status:recorded,receipt}; genuine missing returns {status:absent}; malformed/orphan pair returns {status:unready,reason:receipt_correspondence_unavailable}. No new-work gates or mutations. |
| private.arcanum_immutable_row_v1() RETURNS trigger | Validate INSERT structural shape/tuple only; deny all UPDATE and DELETE except actual parent deletion; no positive admission issuer. |
| private.arcanum_pair_closure_v1() RETURNS trigger | Deferred after INSERT on each private table, re-read BOTH final paired rows under exact character/operation/selection tuple and require full correspondence. Missing/mismatched pair raises; actual deleted parent is the only lifetime exception. No issuer or source-eligibility claim. |

Shared prefix definition is concrete: require nonnull character + actual existing
private.hit_die_context_shape_v1; call private.require_verified_hit_die_auth_v1
(unchanged always-denied implementation); call actual
private.lock_character_writer_guard_v1() (exclusive FOR UPDATE); SELECT current
owned parent FOR UPDATE with owner derived ONLY from that verified context. After
wait, re-call native verified Auth/session check and clock_timestamp() >= expiry
denial immediately before any read/receipt return, including equality expiration.
Missing current owner denies. Return original receipt actor/time/revisions unchanged.
No caller-GUC/current_user-only bypass, getUser/sessionless issuer or hidden RLS proof.
Native Auth still denies all actual calls in v1; hypothetical modeled rows do not
prove native roles. Existing Auth function behavior/13false rows must remain exact.

Replay lookup immediately follows that prefix, BEFORE any NEW earned lineage,
controller/history/source/acquisition/retirement/order/expected-revision gate. Match
canonical intent for select replay; resolve has operation ID only and validates its
original canonical intent/tuple. Read immutable receipt under owned parent (no FOR
SHARE on SELECT-only receipt rights). Replay does not infer active eligibility or
new grant generation. Read/resolve cannot erase a capture or modify state/counters.

Exact installation/definition order, no forward-body validation assumptions:

1. Preflight unchanged R09 stage/helper signatures and original owner properties;
   begin one transaction. Existing owner inkborne_hit_die_authority_owner proposed
   for ALL new private objects, subject original-owner review; no new memberships.
2. Create selection table with character FK/unique tuples; create receipt table with
   character FK/unique tuples; add reciprocal deferrable FKs after BOTH exist.
   Assign ownership; ENABLE + FORCE RLS. Owner-only SELECT policies only; NO runtime
   INSERT/UPDATE/DELETE policies or grants in this first child.
3. Define request/capture/correspondence validators, then the three literal false
   seams/refusal, then parent-prefix helper, then raw reader, command and resolver.
   Each body may reference ONLY already-defined local or unchanged existing helpers.
4. Define immutable row guard plus pair-closure after validators exist; immediate
   BEFORE INSERT/UPDATE/DELETE triggers on both new tables, and DEFERRABLE INITIALLY
   DEFERRED constraint AFTER INSERT pair-closure triggers on both. No original
   character/grant/source triggers replaced. No unrelated table RLS activation.
5. Same-transaction exact-signature/table REVOKE ALL FROM PUBLIC,anon,authenticated,
   service_role; NO new EXECUTE grants/public functions. Function owner retains own
   internal calls, not a caller membership/authority grant. Commit ACL closure.

Future native installation/role/FORCE-RLS/RI/trigger/function compile tests require
G2. The new command seam compiles and refuses; it is not a completed transaction
producer. No positive SQL fixture is asserted from source/token/constructor tests.

## Separately required coordinated producer/payment children

Original R09 owner must challenge/implement narrow choices UPDATE privilege and a
GENUINE full choices delta. Recommended future choices.advanced_spell_selections
map links stable earned occurrence→private selection ID, private rows authoritative;
it is a choice change, not artificial no-op touch. Normal revision trigger assigns
OLD+1 exactly once and rebinds order; no manual bump/P1 confirm-origin metadata event.
Current role cannot do this. New canonical/protected earned bridge must survive
rematerialization and retain prior selections across new grant generations first.

A reviewed unified reader must cover private selections, complete counted grants/
refs/inactive captures, required selected-spell versions + native version times and
current source-access rows in ONE stable full source/permission lock union BEFORE
admission. Do not call current reader then append differently ordered source locks.
No implied private-domain privilege/order producer, readiness marking or legacy
adoption. Exact Auth/canonical/lineage/graph/order/choices/ref/grant/spell/copy/lifecycle
writers and source-access fences remain prerequisites before positive issuance.

Only after that source contract/G2 proof may a real first-selection command atomically
capture binding + genuine choices delta/observed revision/order + original reciprocal
receipt. New work rechecks expected revision/eligibility/acquisition after waits;
replay/refusal bumps0; successful first choice+1. Fault anywhere rolls back all writes.
Same-operation immutable-intent recovery; absence never cancellation/new UUID,
no automatic retry. Saved ID retained on cache/storage/navigation failure; reload
lost intent recovery-only. V1 cannot write even if staged fixtures are injected.

Later actual player chooser and dependency-receipted casting must derive exact
saved choice/active earned bridge under the same authoritative operation and compose
feature-use+effects+concentration in one accepted write, with ambiguous completion
recovery/no duplicate rolls. Slot/source/subclass local acceptance is not that proof.
Arcanum first; Mastery and independently exhausted Signature choices remain separate
required M6 work. Current pooled Signature2 counter cannot supply per-choice authority.

## Exact next paths, measurable controls and decision boundary

After amended independent challenge, sole writer proposed ONLY:

- NEW supabase/staged/arcanum-first-selection.sql;
- NEW lib/spells/arcanum-selection-schema.ts;
- NEW tests/fixtures/arcanum-selection.ts;
- NEW tests/spells/arcanum-selection-source-model.ts;
- NEW tests/spells/arcanum-selection.test.ts;
- NEW tests/supabase/arcanum-selection-staged.test.ts;
- bounded source handoff. Frozen R09/P1/advanced resolver/parser/app bytes unchanged.

Controls: actual staged definition order/signatures/ACL/constant refusal bodies;
self-consistent request+reciprocal tuple tampering/foreign parent; orphan reciprocal
row; raw/byte/count extra/missing/duplicate pairs; revision/string bounds/finite time;
protected occurrence rematerialization without bridge refuses even same slug/version;
retained selection cannot become unselected on new grant ID. Read valid spent0 AND1+
without hiding/reset/spend or cast-ready status; malformed/colliding usage unavailable.
Do NOT reuse cast resolver to require unused state for read/choice. Copy kind/pointer
v1 refusal; later versioned map root/immediate lineage/spent continuity tracked.
Native owner/expiry-after-wait/equality, receipt-before-NEW gates and original actor/
time replay contract; command must refuse even with self-consistent caller context/
modeled provenance/13 fabricated ready booleans. Static source binding vs semantic
model cases remain labelled separately; no native SQL/cast proof. Original fixtures
can model recorded first_choice rows only, not a released privileged producer.

No new human decision is required for this compile-disabled recommendation. Storage/
stable-identity/projection/copy bridge are proposed technical contracts for challenge,
not fabricated approval. Offering replacement/respec and permitted use-history timing,
legacy adoption/reselection/reset, or altered copy spent-use semantics remain separate
material product decisions. NO substitute diagnostic UI or active issuer. M6/gameplay/
Mastery/Signature/native acceptance remain incomplete; this child is unready by design.
