# R06/R12 P1 — class origin producer and writer closure plan

2026-10-12, documentation only. Owned branch `codex/r12-passive-features`, base
78ceecb05886a013563bb8946e75ce418ed22c3d. Root comparison inventory is
7a68def578f4f3221ee884c085eafbca3e293b8a. Mandatory predecessor is
[private class plan, Amendment B](2026-10-12-private-class-authoring-plan.md),
approved at 87e3a30. C1 is independently accepted pure source with 60 focused
tests/typecheck/lint on 726acea; it has NO app imports, producer or stored authority.
This plan proposes P1, not implementation, execution, readiness or NEW class completion.

## Frozen coexistence and first stopping point

Use the exact R09 Git object **66621332b69b5f25a93df55ccf1bb73a67ad7d4d**,
`supabase/staged/hit-die-authority-and-writers.sql`, and approved reader plan 3a341.
Do not inspect an unfrozen metadata-v2 working diff as if accepted. The shared
gameplay CAS is `public.characters.action_revision` bigint, transported as canonical
decimal text. `private.character_writer_guard_v1` is singleton; actual
`private.lock_character_writer_guard_v1()` takes **FOR UPDATE**, not SHARE.
`private.character_projection_order_v1` stores producer_revision and complete
ordered ID arrays for pins/inventory/spells/feature_grants/spell_grants.

All thirteen `private.character_writer_readiness_v1` families remain false:
auth, order, state, character_choices, refs, feature_grants, spell_grants, inventory,
spells, shared_rules_access, version_identity, copy_award, lifecycle. No P1 routine
may mark any family ready. A class-local command_revision sequences class commands
only; it neither replaces action_revision nor certifies writer participation.
Frozen R09 has an unavailable production Auth seam, no order producer, no activated
writer statement guards/cutover, and only an inspiration adapter. Those are facts,
not readiness exceptions. P1 cannot positively authorize production through them.

Smallest first implementation child after this plan's independent challenge:
additive staged storage/ACL/marker/deferred-closure source and internal request/result
contracts with exact transaction model/static tests. Auth/gates stay unavailable,
no application wiring, no global privilege removal or migration filename, no SQL
execution. Later finite children implement actual producers/writer adapters and
authorized G2 proof. No source child is substituted for those later gates.

## Actual writer inventory and required closure

Paths are relative to repository, with exact function/handler names; sorted migration
source is not proof of deployed functions, owners, trigger order or ACLs.

| Existing path / observed behavior | P1 adapter or fence required before availability |
| --- | --- |
| `app/(app)/characters/new/actions.ts:createCharacter` (:7, gated RPC :28, direct insert :35) immediately redirects into editable builder. `lib/supabase/characters.ts:createCharacter` (:51) also inserts directly, accepts caller user/system/campaign IDs. | One reviewed atomic genuine-fresh creation adapter; derive verified actor, validate published system/current campaign entitlement, create draft header/empty real order atomically. Old direct inserts may create legacy/unavailable characters but never bootstrap origin. Retire/restrict these normal creation paths before enabling the new path. |
| Staged `starting-equipment-transaction.sql:create_character_with_starting_grant` (:103), service-only actor argument; inserts character plus eligible grant. | Same internal fresh bootstrap in its existing transaction, preserving eligible grant and default-off equipment gate. No second best-effort metadata request, inferred origin or fallback after uncertainty. Existing routine has no class provenance. |
| `class-step-client.tsx:handleSelectClass` (:199): whole choices/level write, then class ref, optional subclass ref in later requests. | Atomic add-class command: server creates provisional/accepted occurrence according to locked header, exact entitled class/version pin and optional subclass parent pin. Request ID/slug are selection, not provenance. No first-click seal. |
| `handleLevelChange` (:255), `handleConfirmLevelUp` (:289), `handleRemoveClass` (:353), `handleSubclassSelect` (:474). Removal writes parent before deleting class ref; subclass writes choices before swapping refs. | Atomic set-level/remove/set-subclass commands using occurrence identity, shared revision and current pin. Removal ends retained occurrence and deletes exact controller/pin projections in one transaction; reinsertion creates a different occurrence. Level/subclass changes cannot rewrite acquisition/origin identity. Parent level equals selected sum, with existing empty-character level floor 1; total <=20, unique slug/occurrence. |
| `handleHpRollChange` (:332), choice/fighting-style handlers (:393/:417), ASI handler (:529), race/subrace/background/equipment clients. | Scoped locked merges with revision; never replace classes from an old whole-choice copy. HP history/order changes are mechanical dependencies. Preserve raw hp_rolls, resolved choices and legitimate earning/pruning semantics. ASI remains its reviewed grant-occurrence command, not a replacement class-origin authority. |
| `character-client.ts:saveCharacterAbilityScores/updateCharacter/updateCharacterAndReturn`; `characters.ts:updateCharacter`; direct PostgREST characters UPDATE/INSERT/DELETE. | Final mechanical column privilege transition and protected-class fence; inspect OLD and NEW classes/level/owner/system and metadata. Reject stale absolute/ABA restoration, omitted occurrence metadata, caller revision/primary/origin claims. Unrelated narrative/name/color may use scoped independent columns; personality helper must merge current locked keys. |
| `content-refs-client.ts:insertContentRef/removeContentRefById`; `content-refs.ts:addContentRef/removeContentRef/removeContentRefsByChoiceSource`; direct INSERT/UPDATE/DELETE/reparent. | Class/subclass identity checks use BOTH old and new immutable version type plus reserved context, not context alone. Exactly one selected occurrence/pin association; no extra unselected/no-save/independent-only class pin. Old/new parent IDs sorted before child DML. Final global child DML removal coordinated with R09; protected marker needed even for privileged adapters. |
| `class/actions.ts:reconcileClassFeatureRefsAction` (:118); `feature-refs-server.ts:syncClassFeatureRefs`; `20260720185305_character_content_boundary_guards.sql:sync_character_feature_refs` (:352). | Explicit guarded reconciliation preserves frozen feature grant identity and minimum unlock. Does not mint origin, attest class saves or repin latest catalog. No positive reader that silently repairs refs. Class command includes required reconciliation before final closure. |
| `20260720185127_feature_grant_integrity.sql:materialize_feature_grants_for_ref` (:152); `20260720185149_feature_spell_grants.sql` materialize/sync/active helpers; `20260721221108...` latest feature pruning. | Trigger-induced ref/grant/spell changes participate in same protected command, exact parent/order/revision closure. Freeze resulting graph including inactive grants and genuine independent effects. Existing SQL resolution alone does not prove historical candidate authorization. |
| `20260721224742_restore_feat_choice_rpc_boundary.sql:set_character_asi_choice`; `20260722221534_atomic_background_selection.sql:set_character_background` (:304); `20261010232200_save_character_abilities.sql:save_character_abilities`. | Revision-aware existing-domain wrappers; preserve class identity unless a separately accepted class command plans it. Legacy ASI/background GUCs are NOT origin permission. Definition/schema reads/access changes share R09 guard protocol. No blanket signature exemption because it is SECURITY DEFINER. |
| Migration `20260722221534_atomic_background_selection.sql:copy_character` (:604); staged equipment replacement (:233); action `characters/[id]/copy/actions.ts:copyCharacter` (:15). | Both effective alternatives call same atomic copy provenance adapter; preserve exact pins/remapped feature/ASI/spell grants and equipment receipts/markers/consumption. Existing copies use `inkborne.asi_choice_rpc/background_choice_rpc` markers and have no origin records. No inferred role from copied choices/equipment completion. |
| `20260720185305...:validate_character_content_boundaries` (:77), campaign assign/unassign actions, `00044_campaign_membership_lifecycle.sql:leave_campaign/remove_campaign_member`. | Current owner/system/archive/campaign and access changes cannot silently transplant or restore origin; current owner checked under shared lock before receipt disclosure. Class system change is unavailable/refused under the first supported protocol. Membership/share/rule changes serialize and recheck exact entitlement. R09 owns complete lifecycle/cascade closure. |
| `scripts/import-srd.ts` classes transformer/promote; `20260720185219_srd_import_atomic_promote.sql:promote_srd_import`; direct homebrew/content/version/admin DML. | Version-identity and future compiler transaction fence. Existing class transformer (:99) emits raw `save_<ability>` and no indexed attestation. Do not rewrite these versions, infer trusted indices, or silently translate prefixes. MPMB server supports reviewed spell/feat, not class authoring/import. |
| Character search/mention API routes; current builder/read pages; private form DALs. | Inspected routes read characters, do not add a class writer. No restore/import-character endpoint was found in inspected app/lib/scripts; absence is not evidence about provider backup/admin tools. Operational restore must preserve full origin/occurrence/command/compiler/order history or remain unavailable. Deployment/admin DML is an explicit trusted operational boundary, never an automatic bootstrap path. |
| `settings/actions.ts:deleteAccount`, auth/profile/owner FKs, version/ref/character deletion cascades. | Real effective RI/provider roles and lock prefix need R09 G2 lifecycle proof. No origin marker waiver based on trigger depth, absent RLS-visible parent or current_user; no new account-deletion policy is smuggled into P1. Character-lifetime receipts retained while character exists; profile removal alone must not delete them. |

Current choices type (`lib/types/character.ts:81`) has slug/level/subclass, no
occurrence ID. Future adapter must add validated occurrence_id for proven new
lineage, preserving raw extension fields and absent keys; legacy rows are not
rewritten from array order. C1's strict pin DTO lacks current required nullable
feature_grant_id. A separately reviewed DTO bridge/version must retain it and
all raw feature/spell grant evidence, before live graph/C2 integration; never
project it away to fit the older pure DTO. The accepted C1 source stays unchanged here.

## Protected storage proposal (all names new unless marked frozen)

Use private schema, RLS defense in depth, exact constraints/indexes and no Data API
table privileges for PUBLIC/anon/authenticated/service_role. Normal caller reads
only bounded owner-authorized RPC results. No exposed raw marker or auth table.

- `private.character_class_origin_v1`: character PK/FK; schema_version=1, system_id,
  origin_status=draft|recorded|legacy_unavailable, nullable frozen origin_occurrence_id,
  creation_provenance=new_character|fresh_draft_copy|confirmed_copy (null legacy),
  creation_operation_id, source_draft_operation_id, role_proof, command_revision bigint.
  Only monotonic class command counter/lifecycle availability change after seal;
  sealed creation/origin/proof identity never changes or reseals. Retain removed
  origin occurrence. Missing header means legacy unavailable, not a new draft.
- `private.character_class_occurrences_v1`: UUID PK, character/system/content ID/
  version/class slug, provisional|accepted|ended, selected_at, nullable actual
  acquired_character_level/acquisition_operation_id/accepted_at, ended_at, exact
  controller_ref_id association. Unique active class slug and ref within character.
  Retain ended occurrence; at most256 retained/20 active, refuse exhausted capacity,
  never purge/reuse history to keep accepting. Subclass association records exact
  ref/version/parent occurrence, not latest slug lookup.
- `private.class_save_occurrence_manifests_v1`: PK(content_id,content_version),
  schema_version, actual producer/compiler ID, same system, immutable full raw
  data/effects and declaration snapshots, ordered occurrence entries with exact
  zero-based effect_index/kind/ability/stat_slug/raw entry. FKs to immutable version.
  <=256 effects/indices and <=128KiB aggregate UTF8 metadata for supported producer;
  no duplicate index/declaration, every candidate classified, no injected partial row.
- `private.character_class_commands_v1`: PK(character_id,operation_id), immutable
  receipt_kind=class_transition, canonical intent/version, verified_actor_id (no profile cascade), before/after
  class sequence and shared action revision, native accepted_at, bounded result and
  confirmation/copy evidence. FK cleanup only with accepted character lifecycle.
  Class sequence advances exactly1 per changed accepted class command. Confirmation
  receipt matches C1 expected/applied CLASS sequence, not the gameplay CAS counter.
- `private.character_creation_commands_v1`: PK(verified_actor_id,operation_id),
  immutable bounded creation/copy intent and resulting target character ID. Serializes
  duplicate new-character/copy requests before target ID exists; no client authority
  over fresh flag. Copy result stores remapped occurrence/ref map and immutable source
  confirmation/occurrence snapshot and separate root/immediate copy lineage below,
  so later source deletion cannot erase target
  proof. Target has new operation namespace; no copied executable command IDs,
  gameplay receipts, linked accepted rolls or target replay ledger from source.
- `private.class_writer_acceptance_v1` plus exact transition entries: database
  transaction ID (xid8), DB-generated acceptance UUID, bounded command/character set,
  acceptance_kind=class_transition|bootstrap_new|bootstrap_copy, old/new protected
  identities where applicable, expected final revisions/order and authorized row
  transitions, finalized flag. Completed immutable records remain with the command
  for character lifetime; they are not reusable permission or background cleanup work.
  Only bounded trusted functions can create/consume.
  No caller marker insert, exposed session variable or generic authorization RPC.

Bounds: class command intent <=32KiB UTF8,20 selected classes, sum1..20 (empty
class state retains existing level floor1); revisions0..9223372036854775807 as decimal
strings, INT4 content versions1..2147483647, supported evidence <=4MiB finite JSON.
No numeric revision conversion through JS Number. Unknown ordinary extension keys
in stored raw data/effects survive; strict command/proof keys reject caller extras.
Class data's saving_throws is currently string[], not a closed canonical enum.
Only trusted compiler/manifest protocol restricts the six abilities. Unknown raw
declaration/candidate is unavailable; an unknown manifest ability is invalid evidence.

## Auth/privilege refinement proposed for independent challenge

Keep ordinary player actions, but propose **service-only versioned RPC transport**
instead of the preliminary87 direct authenticated RPC. The server action verifies
one token with getUser plus cryptographic claims from THAT SAME token, constructs
the frozen R09 context, and never accepts actor/session/context from browser form
data. Cookie-free service client does not impersonate auth.uid or set JWT GUCs.
This interface change requires this plan's independent approval; it is not already
implemented or provider-authorized. No source-only positive Auth replacement.

Proposed `public.apply_character_class_command_v1(context,intent)`,
`public.create_character_with_origin_v1(context,intent)` and
`public.copy_character_with_origin_v1(context,intent)` are unique VOLATILE POST
primary RPCs; revoke PUBLIC/anon/authenticated default execution, grant service_role
EXECUTE only. Private bounded routines owned by separate NOLOGIN/NOBYPASSRLS/
NOINHERIT/non-superuser class-writer and compiler roles; no caller membership,
schema CREATE, generic actor-based bootstrap or generic metadata setter. Explicit
selected-column/table grants and owner-role RLS accompany ownership, not assumptions
about SECURITY DEFINER bypass. Fixed empty search_path, schema-qualified objects.
Compiler role cannot mutate characters/origin; class writer cannot attest arbitrary
versions. Superuser/deployment remains trusted outside application security scope.

Reuse frozen `require_verified_hit_die_auth_v1` Auth user/session/profile prefix;
today it unconditionally refuses. Actual session/config expiry/native JWT equality,
provider/RI order and current-owner proof require G2. Fresh acceptance rechecks actor,
character user_id, archived/system/campaign/access after lock waits. Replay checks
current owner/session before revealing any historical receipt, then receipt first
before today's gameplay gate/version/access/expiry of mechanical inputs. Owner
transfer/foreign/missing rows give inaccessible; no raw error/state dumps.

## Exact transaction, revision/order and marker closure

Strict class request version1 keys are `{contract_version, character_id,
operation_id, command, expected_action_revision, expected_class_revision, fields}`.
Revisions are decimal strings; command-specific fields are exactly:

| command | fields (request selection only) |
| --- | --- |
| add_class | `{content_id, content_version, subclass:null|{content_id,content_version}}`; new class level1, server occurrence/ref IDs |
| set_level | `{occurrence_id, level:int1..20}` |
| set_subclass | `{occurrence_id, subclass:null|{content_id,content_version}}`; actual immutable subclass parent must match that selected class |
| remove_class | `{occurrence_id}` |
| reorder_classes | `{occurrence_ids:UUID[]}` exactly the active selected set, meaningful requested order |
| confirm_origin | `{selected_occurrence_id}` with explicit HP ordering consequence |

No source slug/compiler index/proof/actor/primary flag/raw choices are accepted as
authority. Add/subclass resolves exact immutable tuple/system/type/parent and current
selection entitlement; retained pin continuity is distinct from permission to acquire
new content. Results are strict `applied|replayed|unchanged|conflict|inaccessible|invalid|
unready`, with command receipt and accepted IDs/revision metadata only on appropriate
success; no stale whole-choice replacement. Full canonical intent includes both
expected revisions and fields (object-key order immaterial, array order significant).
The stored C1 confirmation subreceipt projects expected_class_revision to its frozen
`canonical_intent.expected_revision`; shared revision stays explicitly separate in
the complete producer receipt. A projected C1 subreceipt is not authentication.

Order: accepted Auth prefix; actual frozen singleton guard FOR UPDATE; known affected
character IDs sorted UUID FOR UPDATE; frozen content definition IDs, system, campaign,
member/share, immutable version tuples in frozen reader order; origin/occurrences/
refs/grants/spells/receipts/order rows in documented stable key order. Copy allocates
target UUID before sorted source/target acquisition; recheck source/current access
under guard before write. If affected set changes, reject before mutation. Semantic
effect/source ordering is separate from lock ordering and never sorted to acquire locks.

Under locks: current-owner check, existing operation receipt lookup and same-intent
replay; changed intent conflict; new acceptance checks class-local AND shared expected
revision, exact selected identities/raw pins/current permissions/gate. Intent contains
no raw full choices/effects or primary flag. Allowed commands: add_class, set_level,
set_subclass, remove_class, reorder_classes, confirm_origin; nonclass merges belong
to their own finite adapters. Same semantic no-op returns unchanged without mutation,
counter increment or new accepted-command receipt; it cannot create confirmation.
Already committed ID replay is immutable and takes precedence over today's counters.

### Changed class transition, including private-metadata-only confirmation

The previous48d9256 requirement for ONE changed parent choices/level UPDATE was
incomplete. Confirming the already-first/only class can seal private origin/occurrences
while every parent field watched by frozen R09 remains byte-identical. It is a real
mechanical authority transition, not a semantic no-op; artificial reorder, level
change, timestamp touch or stale whole-choice write must not manufacture its revision.

Joint P1/R09 proposal: extend the frozen parent revision trigger with a **protected
class metadata transition branch**, separately reviewed before any implementation.
Trusted acceptance rows bind character/xid8/command, actual before+after private
origin/occurrence identities, locked expected shared/class revisions and one initially
unconsumed revision-transition entry. Admission must observe a genuine allowed
metadata change (for confirm: draft→recorded, selected provisional→accepted,
immutable origin binding and class counter+1), not only a caller request flag.

For a changed choices/level command, the ordinary watched-field branch assigns
old action_revision+1 and consumes that SAME class transition entry. For metadata-only
confirmation, a narrow private `apply_class_metadata_revision_v1(acceptance_id)`
performs a meaningful revision-only parent UPDATE after validated private metadata
mutation. It accepts no desired revision/actor/raw patch. The joint BEFORE trigger
validates the actual protected entry, current old parent, changed private identities
and exact old+1 value, then consumes the entry once. This is a database-owned revision
operation authorized by protected evidence, not a caller increment or no-op touch.
Only the proposed bounded owner routine may request this path; role/current_user/GUC
alone is insufficient. No private marker means the frozen unchanged-parent revision
rejection remains in force. Reuse/consumed/forged/unchanged metadata rejects.

Thus each changed class transition has exactly ONE shared bump whether watched
parent fields change, private role metadata changes, or both. Never use both branches
as two increments. The existing AFTER parent trigger rebinds existing
order.producer_revision only; full order closure still follows. Class counter
separately advances1. Actual protected metadata mutation, receipt, revision transition
and order rebind roll back together on any immediate/deferred fault. Until this joint
trigger path is accepted, metadata-only confirm is UNIMPLEMENTABLE, not an omitted
test or a command made available by an artificial parent edit.

All associated child/occurrence/pruning/materialization
writes belong to that protected outer command; they do not independently advance
revision inside this class transaction. This is a proposed exact batch participation
contract requiring joint R09 review, NOT an existing child-trigger exemption.
Standalone child reconciliation/writers need their separate R09 adapter/invalidation;
they cannot reuse a class acceptance or claim a no-op parent touch incremented revision.
Do not hand-set action_revision against the frozen trigger or accept unexplained >1.
The proposed joint revision branch is not present in frozen666; P1a may declare
strict transition storage/finalizer source but cannot claim this producer path exists.

### Bootstrap initial state, distinct from a transition

Fresh create/copy is an INSERT, with NO old target state and no UPDATE bump.
Separate strict creation receipt variant `receipt_kind:bootstrap_new|bootstrap_copy`
contains target_character_id, creation_operation_id, verified_actor_id, canonical
creation/copy intent, native accepted_at, `initial_action_revision:'0'`,
`initial_class_revision:'0'`, `initial_producer_revision:'0'`, created IDs and
origin/provenance summary. It forbids before_revision/before_state/expected target
revision fields rather than manufacturing zero-valued before evidence. Class-transition
receipts require actual before/after revisions and cannot parse as bootstrap receipts.

Trusted target INSERT uses database default action_revision0; fresh target header
command_revision0 and order.producer_revision0. Copy source revision/counter remain
source evidence only, never target counters. Bootstrap creates no accepted class
transition receipt or confirmation. New copy target lifecycle may be recorded or
ended via preserved lineage, but its local sequence is still0; this is source-copy
provenance, not target confirmation execution. Later changed target class command
starts the normal0→1 transition. Target replay of bootstrap returns the same initial
receipt plus current readback separately, even after target revisions have advanced.

Bootstrap finalizer is a distinct acceptance-kind branch: verifies new target identity
with no prior target/header/order, exact initial0 counters/order and complete created
row/provenance graph plus bootstrap receipt. It does NOT assert before+1. Immediate
and deferred checks use the same bootstrap branch. Compose final copied choices,
including inherited equipment-confirmed marker, BEFORE target INSERT. Existing
staged copy's post-INSERT choices correction must be replaced in its later adapter;
no post-insert UPDATE is allowed to silently convert bootstrap0 into1. Unexpected
target UPDATE/bump/second bootstrap aborts closure, rather than resetting a counter.
Equipment eligible/inherited grant, refs/grants/inventory/spells and origin/order
all join this same bootstrap transaction; source counters/order are unchanged.

After child mutations, an actual order producer updates semantic arrays by retaining
existing survivors in original order and appending new rows in the authoritative
operation's declared insertion/materialization order. Never timestamp/ID-sort to
invent historical tie order. Existing unproven order rows stay unready; fresh create
has genuinely empty domains, not synthesized legacy emptiness. Copy remaps source
proven arrays preserving order; missing/duplicate/orphan mapping refuses. Rebind final
producer_revision to the accepted parent revision, check complete table-ID bijections
and frozen inactive grant closure; do not let simple revision rebind certify new IDs.
Triggers/pruning that create unexpected parent writes or ambiguous insertion order
must fail closure and remain unready until the exact adapter is revised/reviewed.

Before protected DML, trusted routine writes exact permitted transition rows under
the transaction's xid8/DB acceptance ID. Row guards inspect OLD+NEW character/class/
ref identities and require matching protected transition, then consume it once.
Role identity is a prerequisite, never sufficient permission. Caller GUC, trigger
depth, current_user alone, forged marker/UUID, reused transaction marker, caller SET
CONSTRAINTS or a no-op update cannot waive the match. Full final graph closure plus
recorded before/after protected values prevents an approved insert from authorizing
an unrelated delete/reparent. Character deletion/cascades need their exact lifecycle
operation, not a hidden-parent exemption.

First supported transaction permits at most one class transition OR one bootstrap
acceptance per target character/xid8, never both. Multiple normal RPCs are separate
transactions. Reject a second acceptance before DML rather than making earlier
closure compare against an unrelated later command's revision.

Queue deferred constraint closure for origin/occurrence/class refs/order and acceptance
record. On commit require finalized accepted command, exactly1 consumed planned
transition each/no unplanned leftovers, one selected class pin per active occurrence
and reverse relation (extra independent-only/no-save pins denied), subclass exact
parent, frozen origin consistency, receipt-kind correspondence, full raw ordering/
projection closure. For class_transition require shared before+1, class sequence
before+1 and consumed revision entry; for bootstrap require initial0/shared0/class0/
producer0 and no transition bump. Routine
forces closure before returning response; transaction commit runs it again. Deferral
does not permit earlier direct DML, since immediate guards require protected entries.
Keep completed marker/consumed transition rows immutable with the lifetime command,
so immediate finalizer and every deferred commit event can recheck the same proof.
Finalized/consumed entries cannot admit further DML, including in the same xid8;
an acceptance from a different transaction cannot match. Failure at any step throws/
rolls back parent, refs, metadata and receipt together. Exact SQL trigger timing/
ownership/completion retention is a first-stage
review and G2 failure-control obligation, not claimed working behavior here.

## Lifecycle and compilation semantics

Genuine fresh create: bounded empty character insert plus draft header/order and
creation receipt in ONE trusted transaction. Incoming nonempty classes/origin proof
refused. Staged equipment create attaches eligible grant in that SAME transaction.
Legacy direct rows, imported sparse rows and partial restores have no fresh marker.

Draft selections remain provisional through A→remove→B, levels/subclass changes,
reorder, reload/opening sheet/overview/equipment award and draft copy. No inferred
acquisition level or seal. Explicit `Confirm starting class` UI from Amendment B
selects one saved provisional occurrence; no radio default. It submits operation
identity, expected shared/class revisions and chosen occurrence. Confirmation moves
chosen origin to first HP position, retains others' relative order, seals exact
content/version at acquired character level1, accepts remaining creation-plan
occurrences with unknown acquisition level left null. Only current complete,
trusted-classified pins can confirm. Unknown compiler/imported legacy lineage shows
unavailable, not an automatic attestation or an empty-profile substitute.

UI explicitly previews HP ordering consequence using actual pinned inputs/existing
rule boundary. `max-hp.ts:45/69` gives first class maximal first die; hp_rolls keys and
independent choices are preserved, not silently regenerated. Confirmation does not
change current_hp, equipment completion or roll history. Sheet-system versus builder
campaign HP-rule split remains disclosed; any proposed HP clamp/rest/respec policy
is outside this child. C2 must verify current/max HP display after deliberate reorder
without falsely granting class roles from array order. Active recorded origin cannot
be reordered away from first HP position; remove/end makes role-dependent origin
unavailable permanently under first conservative contract. Reinsert does not reseal.
Post-seal new classes get separate accepted secondary occurrences and genuinely
known acquisition operation/time; no guessed historical level for an empty respec.

Draft copy produces fresh_draft_copy header plus remapped provisional occurrences
and source draft operation lineage, no origin. Recorded copy preserves source
confirmation and exact class pin/version with target occurrence/ref remaps; source
ended/unavailable origin stays ended/unavailable even if absent from target active
choices. Legacy copy stays legacy, no marker added as new-character proof. Retained
source proof is immutable snapshot in copy receipt, never fabricated target execution
of source operation. Copy-of-copy lineage is frozen separately below. Restore requires exact marker/occurrence/commands/manifests/order
bundle; partial restore remains unavailable, no bootstrap repair.

### P1c copy-of-copy lineage: original anchor and immediate source are distinct

For A confirmed, B copied from A, C copied from B, C retains A's original confirmation
canonical character_id/selected_occurrence_id/operation_id/expected+applied class
sequence/accepted_at exactly. Never relabel A's receipt as B or C. Immutable root
anchor includes A's actual origin occurrence **at original confirmation** (original
character/occurrence IDs, content/version/slug/acquisition identity/time/level1) and
the original confirmation. Current lifecycle is separate, not a rewrite of that
original snapshot. No recursive fabricated confirmation or target-origin election.

Each protected bootstrap_copy receipt stores these distinct fields:

- `root_confirmation` and `root_occurrence_at_confirmation`, unchanged from the
  validated source root anchor;
- `immediate_source`: source_character_id (B), source_origin_occurrence_id (B's
  remapped occurrence), source creation/copy operation ID, exact locked source
  action/class revisions, source origin status and current lifecycle/ended_at,
  source current origin/pin identity and retained raw provenance;
- `source_copy_receipt_identity`: null for direct original A, otherwise the exact
  protected source bootstrap-copy operation/target identity and validated root-anchor
  correspondence from B's stored receipt. This is trusted writer evidence verified
  under lock, not a caller digest or a request to adopt legacy rows;
- `target_map`: immediate B occurrence/ref UUIDs→new C UUIDs, including retained
  ended origin occurrence separately from active pins; target current lifecycle/
  ended_at preserves immediate source B. Only existing active pins are copied into
  active projections. Copy metadata must not resurrect a removed controller ref.

Copy validates source protected receipt/header/map/root consistency before storing
this bounded flat attestation; it does not recursively copy an unbounded ancestor
receipt graph or duplicate source command ledgers. Target stores its own immutable
validated immediate-source snapshot and root anchor, so source deletion does not
erase proof. A source lacking real producer lineage/receipt cannot be bridged by
matching tuples, array order or claimed IDs. If B's origin ended while A remains
active, C is ended/unavailable: A's confirmation stays untouched and B's separate
ended lifecycle governs the target. If A ended before B copy, every downstream copy
preserves that unavailable lifecycle without reseal. Source state/receipt never mutate.

Accepted C1 currently proves injected direct-copy shape only. Its v1 copy proof
compares source occurrence lifecycle directly with target and cannot represent this
root-vs-immediate distinction in every multi-hop/ended case. P1c must add a separately
reviewed versioned lineage/read DTO bridge plus positive/negative controls before
copy availability; never squeeze multi-hop evidence into v1 by rewriting root IDs
or its historical lifecycle. This is a named prerequisite, not a C1 production claim.

First NEW class compiler is `private-basic-class-v1` only: genuine private authoring
transaction validates one published dnd-5e-2014 system with exactly six unique actual
ability definitions and one proficient multiplier1. Compiler emits one
`{type:'grant',stat:'saving_throw_'+ability,value:'proficient'}` per explicitly selected
unique ability in declared order, records exact emitted indices/raw entries/full
version snapshot atomically with canonical definition creation/version trigger.
No six derived-save-stat requirement, invented PB, guessed proficiencies/slots,
arbitrary effect submission or browser compiler ID. Actual consumer PB must be finite.
The future class form must have complete20 unique noncaster rows and real declared
hit die/proficiency fields as in class plan; not implemented by this prerequisite.

`class-save-occurrences-v1` in C1 is an advisory future fixture protocol, NOT a
production allowlist. Independent class-level identical grants need a separately
accepted real producer that labels every occurrence, including duplicates; do not
mint that lineage from historical tuples. SRD legacy save_ and old import/compiler
rows remain unready/raw-preserved. Text-only trusted class edits may clone manifest
to the new version only inside the same transaction when raw effects/declaration
and mechanics/extensions/absence/order are exactly unchanged. Historical pinned
versions/manifests never update. Catalog direct mechanics edits/new snapshots without
accepted compiler transaction cannot create trusted classification. Existing
independent race/feat/feature/class-level grants retain source/effect order untouched.

## Finite implementation children and measurable gates

| Child | Bounded deliverable / evidence | Remains off/unimplemented afterward |
| --- | --- | --- |
| P1a first, after challenge | New staged `supabase/staged/class-origin-producer.sql` source (not migration), internal strict request and distinct transition/bootstrap receipt schemas, original fixtures/model/static tests. Actual staged immediate and deferred finalizer function/trigger source checking new protected storage/ACL/marker/receipt/order contracts; Auth unavailable/all13false/default-off gate. No app imports or old writer/cutover activation. | Joint metadata-only revision producer, real bootstrap/command writers/materializers, all client adapters, G2, C2/NEW class. |
| P1b | Atomic genuine fresh + existing equipment-create integration, class add/level/subclass/remove/reorder/explicit-confirm transaction source, private-basic-class compiler transaction seam; model and separately authorized disposable SQL tests. | Actual Auth/provider/role acceptance; copy/indirect writers until closed. No authoring form as shortcut. |
| P1c | Both copy bodies/provenance, scoped nonclass choices and all ref/materializer/prune/reconcile adapters; shared order production and exact revision participation with R09. | Every unclosed state/inventory/spell/access/lifecycle/admin/restore family remains false. |
| P1d | Reviewed exact ACL/function/trigger activation manifest closing ALL table/column/old-definer/service/lifecycle paths; original G2 role/HTTP/JWT/concurrency/fault proof and no fabricated readiness. | Deployment/cutover only by separate authorization; C2 UI still required. |
| C2 then NEW class | Accepted DTO bridge/actual save/concentration/print/provider readers; unavailable UX and independent grants; complete structured class creator plus separately tracked subclass/attachments/advanced mechanics children. | No whole M4 completion or import/publishing claim from first basic class. |

Proposed first child touchset ONLY new staged source, `lib/character/class-origin-command-schema.ts`,
`lib/character/class-origin-command-model.ts`, corresponding focused tests, original
fixtures and handoff. Existing C1/evaluator/provider/ASI/source effects unchanged.
P1a is not a models-only substitute: staged immediate admission and distinct
transition/bootstrap deferred finalizers are real SQL SOURCE deliverables, unapplied
and unreachable through production Auth. Full producer/materializer/copy and joint
R09 metadata-revision implementation remain later children. Any required frozen R09 helper ownership/order/revision source alteration is separately
challenged before edits. Do not run migration CLI, generate migration name or execute
this SQL from an npm test. G2 target/resource/role budget and cleanup manifest must be
reviewed separately and require actual human authorization; it is absent today.

Finite acceptance controls before P1 availability:

1. New marker/header/order/equipment eligibility all commit or all roll back; duplicate
   same creation operation yields one target; changed-intent reuse conflicts. Legacy
   empty/single/nonempty inserts cannot confirm. No header later bootstrap.
2. Draft A→remove→B/levels/subclass/reorder/reload/overview/equipment/draft-copy never
   seal. Explicit B confirmation establishes only B and deliberate first-HP order;
   malformed/foreign/stale/nonselected/ended/ambiguous occurrence refuses atomically.
3. Eight same-ID independent connections produce one accepted class command/receipt;
   two different IDs at same revisions produce one success/one conflict. Lost response
   lookup after reload returns original occurrence; current newer choices are reloaded,
   never overwritten by old receipt. Same ID altered class/version/order is rejected.
4. Action revision exactly1/class sequence exactly1/order rebind and complete child
   bijections after actual trigger side effects; no-op exactly0; exhaustion refuses
   new mutation but receipt replay works. Conflicting inspiration/ASI/level/ref/award
   attempts serialize, with no ABA or unversioned absolute writer success.
   Metadata-only confirm of an only level1 class, only higher-level class, and already-
   first multiclass origin advances exactly1 even when watched parent bytes are
   unchanged. Confirm moving a different class first also advances only1. Duplicate
   receipt replay advances0; ordinary unchanged level/subclass/reorder is0; same-
   origin different-operation reseal refuses. Fake pending marker without actual
   metadata delta and a second consumed revision transition refuse. Bootstrap fresh/
   draft-copy/recorded-copy initializes0/0/order0 with absent before fields; source
   high counters do not leak, unexpected post-insert UPDATE aborts, duplicate bootstrap
   creates one target and advances0. Transition/bootstrap receipt substitution fails.
5. Ordinary/foreign/anonymous/service generic DML and old RPCs cannot inject header,
   manifest, receipt, marker, origin/reseal, class/subclass reparent or caller revision.
   Forged GUC/current_user-only path/SET CONSTRAINTS/same-PID-next-transaction marker
   never authenticates. Real role denial uses exact SQLSTATE/zero-row expectation and
   privileged unchanged before/after checks, not arbitrary caught errors.
6. Inject failures between every parent/ref/grant/order/receipt/finalization step,
   including deferred commit failure, and observe zero partial metadata/receipt.
   Unexpected raw class source independent-only/no-save pin denies reverse closure.
7. Two identical indexed grants preserve independent occurrence; raw legacy save_
   stays separate unavailable, not rewritten. Unknown raw declaration versus strict
   manifest invalidity remains distinct. Catalog v2 drift cannot replace pinned v1
   raw data/effects/index classification or current-independent source order.
8. Copy genuine draft/recorded/ended/legacy with exact remap, source unchanged, feature/
   ASI/spell/equipment provenance/consumption intact. Partial restore denies proof;
   source removal/profile lifecycle cannot erase surviving target/character receipts.
   Copy-of-copy A→B→C retains A's original confirmation IDs/time/intent and separately
   records B→C exact immediate remap/revisions. B-ended/A-active produces C-ended;
   A-ended-before-copy stays unavailable through later copies. Wrong root ID, forged
   immediate-source receipt, missing retained ended occurrence, active resurrected
   origin pin, mismatched source/target map or copied counters refuses atomically.
9. Actual authenticated HTTP/JWT owner/revoked owner/session/expiry boundary/current
   access tests plus provider/RI lock prefix must pass separately from trusted psql
   role/claim simulation. Browser draft/pending/native reset/error/malformed/uncertainty
   and manual recovery later exercise actual UI; no automatic retry/fallback creation.

## Rollout, rollback and explicit limits

No existing clients are broken by an incomplete staged fence: additive source remains
unapplied/default-off. Before final activation, all listed writer adapters and their
clients must work, then remove broad table-level mechanical UPDATE/child DML and old
privileged signatures in one separately authorized exact transaction. A column REVOKE
alone does not override table privilege. P1 cannot independently mark R09 families
or activate a per-character cohort from a browser flag. No readiness comes from tests
which injected trusted evidence or replaced unavailable Auth helpers.

Rollback disables new command/gameplay availability, preserves accepted origins,
occurrence history, version manifests, revisions, receipts and fences; never restores
legacy whole-choice writers, deletes uncertain receipts, reseals history or guesses
new role. Provider lifecycle/Storage/session maximum-lifetime/administrative restore
remain explicit operational prerequisites. No actual database/catalog/ACL/auth state
was queried or changed for this plan. C1 locally accepted does not make P1 implemented.

Maintainer references checked for the proposed design: [Supabase functions](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Postgres17 locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[transaction IDs and effective roles](https://www.postgresql.org/docs/17/functions-info.html),
[constraint trigger timing](https://www.postgresql.org/docs/17/sql-createtrigger.html)
and [function privileges/search path](https://www.postgresql.org/docs/17/sql-createfunction.html).
Function privileges are separate from RLS; deferred constraint timing does not replace
immediate admission. `current_user` changes in SECURITY DEFINER; xid8 is transaction
correspondence, not user authentication. Supabase changelog index fetched read-only
2026-10-12; observed TLS cipher/API and unrelated SDK adapter notices do not resolve
this plan's actual Auth/provider/Postgres-version G2 obligations.
