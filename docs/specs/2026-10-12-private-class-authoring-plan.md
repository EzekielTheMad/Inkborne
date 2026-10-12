# R12.6b private class authoring — finite plan for independent challenge

Planning only. Read exact root `b4e308f` (integrated passive browser preparation)
through Git objects; owned worker remains clean predecessor `5fedd6222eeb97c11f7645dac580cbebee845311`
on `codex/r12-passive-features`. This document proposes the first class child;
no implementation, install, test, build, browser, SQL or provider operation.
No other worktree writes. Root owns review, integration and runtime authority. Canonical2014 rule source: [Basic Rules2014 multiclass proficiencies](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/customization-options#Proficiencies) and [Sage Advice2014 multiclass saving throws](https://www.dndbeyond.com/sources/dnd/sac/sage-advice-compendium). These support distinguishing starting-class saves from later feature grants; removal/respec policy is unresolved.

## Decision: meaningful NEW creation has a concrete prerequisite

Do not implement the proposed all-empty class as a substitute for useful class
creation. A deliberately featureless noncaster is a valid diagnostic shape, but
is too weak as the recommended first authoring product. A meaningful bounded
noncasting NEW class should at least let the user choose its saving-throw
proficiencies, using declared finite choices and the actual published system keys.
That is NOT currently safe just by copying transformer grants.

Evidence: `scripts/transformers/classes.ts:transformClassEntry` emits
`buildGrantEffect(save_<expandedAbility>, proficient)` separately from
`saving_throws`. `app/(app)/characters/[id]/page.tsx` around260 and class-step-client
around178 flatten ALL content-ref effects; `CharacterProvider` around406 forwards
allEffects to `evaluate`, whose grant branch collects grants unconditionally.
`grantEffectSchema` has no class role or condition. `buildCharacterStructuredSources`
chooses the first class's structured data, but does not filter the flattened effects.
No `filterStructuredSources` function was found at inspected source. A secondary
class with copied save grants would incorrectly acquire class saving proficiencies.

Prerequisite before NEW class authoring: independently challenge and accept a
bounded provenance-aware class save-grant collection contract across sheet/server,
live provider and builder consumers, using actual exact-version selected class
pins and preserving effects/order from race/feat/feature/other sources. Do not
change generic evaluator formulas or migrate existing effects to solve it. The
precise primary-role policy is still unknown: HP uses choices.classes[0], but that
does not prove which original class grants saves after array reorder or removing
the initial class. No immutable starting-class role contract was established.
The prerequisite must choose/verify that policy and fail closed on missing or
ambiguous matching pins; it cannot quietly assume current first array entry is
the historical starting class. Character-copy and historical pins must preserve
whatever accepted role authority applies. That work is outside this docs child.

Once accepted, a minimal meaningful NEW class form can use Name, Description,
explicit d6/8/10/12 and a unique user-selected save subset (0..6, no guessed pair)
of strength/dexterity/constitution/intelligence/wisdom/charisma, matched server-side
to exactly-one published2014 system ability definitions and supported save/proficient
keys. No arbitrary grant stat, value, formula or client-supplied system schema.
It retains exactly20 explicit inactive casting/empty-feature rows, no subclass,
extra features, attack/ASI schedule or nonempty general proficiencies. If actual
published configuration cannot establish those six keys, refuse NEW rather than
invent a default. Exact stored save declaration/effect pairing and primary versus
secondary runtime acceptance must be specified in that prerequisite, not guessed
by this first plan. No automatic noncaster/caster mechanics.

**NEW class authoring is BLOCKED on the independently reviewed R06 primary/secondary save-grant correction. Existing private class
name/description-only editing and Homebrew discovery may be separately scoped later, but are not a substitute for the NEW class requirement. No NEW link/route or zero-save
create workaround until the save-role prerequisite is accepted.** This is not
R12/M4 class authoring completion. Existing nonclass authoring and pending M4 work
continue while that prerequisite is resolved; no rollout or implementation has
been approved by this document.

Source inspection establishes expectations, not persisted character acceptance.
Real role/trigger/pin/equipment gates remain required; starting equipment retains
its separate default-off boundary. No equipment or character write is proposed.

## Actual contracts and consumers

| Evidence at b4e308f | Constraint for this plan |
| --- | --- |
| `lib/schemas/content-types/class.ts:classDataSchema` | Required positive integer hit_die, nullable class spellcasting, multiclass object, saves/proficiencies arrays, >=1 levels. Each row level1..20/features array; row casting optional/null. Schema does NOT require20 rows, uniqueness, closed save vocabulary, resolved feature references or bounded arrays. |
| Same class schema + `mechanical.ts` | Optional attacks/improvements length20; class known cantrips empty or20, known spells20 or all; spellcastingList/Extra, structured proficiencies and source refs have their own forms/defaults. Canonical defaults are admission output, not authoring instructions. |
| `lib/schemas/content-types/subclass.ts:subclassDataSchema` | parent_class is a nonblank identity string; casting full/half/third/pact, known cantrips20 and spells20/all, explicit9-slot rows, optional preparation rule and tier/array spell extras. Not interchangeable with parent class fields. |
| `lib/spells/slot-resolution.ts:resolveSpellSlots` | Unique SELECTED row required, explicit row null means inactive; omitted casting is unavailable even with top-level null. Active row has exactly9 finite nonnegative integers. Pact permits at most one populated slot tier and at most one pact source. Total class levels<=20. |
| `lib/spells/effective-sources.ts:resolveEffectiveCastingSources` | Exact parent/subclass pins; validates parent pairing and source profiles; no latest-catalog fallback. Full/half/third weights and separate pact are runtime rules, not authoring defaults. |
| `app/(app)/characters/[id]/builder/class/{page.tsx,class-step-client.tsx}` | Page uses existing getContentByType class/subclass/feature catalogs under RLS. handleSelectClass saves choices and inserts exact id/version class pin; class-step uses pinnedEntries, active manifests and existing grant reconciliation. Authoring must not bypass or call these writers. |
| `lib/builder/class-features-per-level.ts:classFeaturesPerLevel/pendingChoicesUpTo` | Explicit empty features on20 rows yields20 empty rows/no ASI/subclass/generic choices. Feature slugs are actual lookups; unknown slugs are skipped in UI, so never author unresolved placeholders. |
| `lib/character/max-hp.ts:computeMaxHp`, `character-context.tsx:computeHitDicePools` use | Chosen class hit_die is used for HP and dice pools; missing-profile d8 fallback already exists and must NOT be used to make a new incomplete class look valid. Preserve observed baseline/live-CON rules; no evaluator/HP change. |
| `lib/character/structured-sources.ts:buildCharacterStructuredSources`, `engine/evaluator.ts` | First pinned class structured attacks/improvements are consumed; existing missing-field fallbacks1/false remain. No invented attack/ASI arrays or computed class progression. Multiclass aggregation limitation remains separately tracked. |
| `lib/builder/multiclass-prereqs.ts:evaluateMulticlassPrereq` | Gate table is keyed to known SRD slugs; unknown custom slug returns met. The conditional minimal NEW class explicitly declares no prerequisites. Nonempty custom prerequisites need a separate actual data-driven consumer contract. |
| `lib/supabase/content-definitions{,-parser}.ts`, `lib/supabase/compendium-server.ts`, `lib/compendium/catalog.ts` | Canonical class catalog already exists, authenticated current discovery under RLS and immutable snapshot parsing preserved. Hit-die filter admits6/8/10/12. No parallel catalog/category. |
| `supabase/migrations/20260720185127_feature_grant_integrity.sql:private.capture_character_feature_manifest` | Captured immutable controller levels/features drive dependency grants. Empty feature arrays iterate no dependencies. Nonempty feature attachment needs entitled exact historical association/manifest acceptance; no application snapshot/grant writes. This is static evidence only. |
| `lib/supabase/feature-refs-server.ts:syncClassFeatureRefs` | Existing sync_character_feature_refs RPC derives grants from persisted choices/pins. Not called by class authoring. |
| `lib/supabase/starting-equipment-server.ts:startingEquipmentEnabled` | Separate default-off staged/service boundary. No generated starting gear, currency, equipment receipt or flag changes. |
| `lib/import/mpmb/{map/index.ts,types.ts}`, `mpmb-imports-server.ts` | Current reviewed MPMB import admits spells/feats; it does NOT import ClassList/SubClassList. Existing transformer fixtures are not browser import acceptance. |

## Conditional meaningful NEW form after R06 (no schema change)

This is NOT implementation-ready before accepted role proof/producer guards.
Normal fields: Name, Description, blank Hit die selector d6/8/10/12, six labelled
saving-throw checkboxes from the exact published2014 ability configuration, and
explicit noncasting rule-set confirmation. No preselected save pair, hit die or
casting profile. Read-only20-row preview declares No features/No spellcasting;
proficiency choices, subclass/ASI/starting gear remain unavailable and disclosed.
No raw JSON editor, guessed formula, source-book citation or derived progression.

Proposed exactly-one-text transport controls: name, description, hit_die,
saving_throws (one serialized ordered checkbox-array string), profile literal
noncaster-v1. Name nonblank<=100; original description nonblank<=20,000; die
string6/8/10/12; save subset0..6 of exact six ability slugs, unique and order
preserved. Server validates published ability/save/proficient-key membership;
arbitrary stats/formulas/effects or client config are rejected. Relevant UTF-8
strings<=131,072 bytes BEFORE JSON/enum/numeric/schema parsing; duplicate/File/
missing/extra controls rejected except framework $ACTION_ metadata. Proposed
new serialized data<=65,536 UTF-8 bytes, reject without trimming; four-byte
20,000-character description can exceed this cap. Error messages stay bounded.

Server-owned raw data: description, hit_die, spellcasting:null,
multiclass:{prerequisites:[],proficiencies_gained:[]}, saving_throws:<selected subset>,
starting_proficiencies:[], levels:exactly20 ordered unique rows
{level:1..20,features:[],spellcasting:null}. No subclass flags, class_specific,
attacks/improvements, source_refs or casting metadata. After R06 role correctness,
standard existing grant format may represent selected starting saves; exact
save declaration/compiled effects equality is a server guard, never raw effect
input. Do NOT emit grants before producer/consumer authority is independently
accepted. No new conditional effect format or direct character grant write.

Validate classDataSchema/effectSchema and canonical definition parser for
admission; discard defaults/stripped output rather than persist rewritten data.
Server-generated UUID/name+UUID-suffix slug/private homebrew envelope for current
owner/exact published dnd-5e-2014. No impersonation of SRD slug-table behavior.
The20-row all-empty-save variant remains useful PURE diagnostic for slot/HP/rail
consumers; it is not a proposed placeholder creation route or a default-save policy.
No new class or equipment operation receipt is invented.

## Text-only edit and provenance

Eligible rows are current authenticated owner's active personal homebrew classes
in that exact published system, including historically imported/created classes.
Platform/SRD, shared, retired, foreign, wrong-system and subtype rows are excluded.
Current MPMB importer does not create classes; do not claim otherwise merely
because synthetic imported-class-shaped records are accepted.

Exactly-one-text edit controls `name`, `description`, `id`, `expected_version`.
UUID; positive decimal PostgreSQL integer1..2147483647, no exponent/leadingzero.
Same text/control budget. Read raw owner-filtered expected-version envelope and
validate canonical class/effect schemas for admission; malformed known mechanics
or effects refuse the edit. Preserve raw top-level/nested extensions, unknown
mechanics, ordered effects/arrays, sparse/reordered historical levels, feature
identity, class_specific, spellcasting/known/list/extra including pact, proficiencies,
source refs and absent optional fields. Do not retrofit20 rows, null casting,
empty source refs or the new die vocabulary to a canonically valid historical row.
The new-data64KiB cap is NOT retroactively used to rewrite/truncate imported data;
edit sends only finite named text controls and UI DTO. Unbounded historical row
size remains an existing server-read concern, not a new browser raw-data editor.

UI DTO exposes only id/name/version/current description and bounded read-only
summary of actual die/casting/row count/save and proficiency declarations, plus
explicit preservation notice. No raw effects/extensions/formulas in normal UI;
summary may cap displayed entries with an honest count, never mutate data. Text
editing does not require resolving feature dependencies or current parent catalog
visibility; historical controller identity/pins are preserved, not relinked.
UPDATE only `{name,data:{...originalRawData,description}}`. Never include effects,
source/scope/system/owner/slug/type/version or snapshot columns. Genuine name+raw
text no-op has no UPDATE, no version bump/revalidation/navigation; exhausted
version refuses changed edit. Final CAS repeats all owner/system/type/source/
personal/active/id/version predicates. Returned confirmation must have exact
identity/slug/created_at/raw intended data/raw ordered effects and next version.
Zero-row CAS uses only current owner's eligible same-id read for conflict/notfound;
no latest rebase or retry. Existing source admission does not assert correct or
complete runtime mechanics, or repair legacy missing casting rows.

No parent reference is used by the conditional class create/edit slice. Future subclass
create must server-resolve exactly one entitled parent in the published system,
validate type/source/scope/owner and immutable parent slug identity; same-slug
foreign parent, wrong system/version and forged associations must be rejected.
Future class-feature attachment must validate actual feature class/subclass fields,
level, exact version entitlement and owner/platform provenance before immutable
manifest acceptance, not trust the passive descriptive class string as authority.
Those two parent/dependency contracts require independent challenge; no guessed
keys or naked slug-only attachment in this child.

## Conditional class touchset after prerequisite (not implementation authority)

New only: `lib/homebrew/class-form.ts`,
`lib/supabase/homebrew-classes-server.ts`, `components/library/class-form.tsx`,
`app/(app)/homebrew/classes/{actions.ts,[id]/edit/page.tsx}` and
focused mapper/DAL/form/actions/pages tests plus original fixture/handoff. No new/page.tsx or CREATE function before R06 prerequisite acceptance; any edit-only slice requires separate release and does not satisfy NEW. Minimal
existing Homebrew family/list/edit integration only; existing Classes
Library/detail discovery already suffices. The later provenance-aware collector prerequisite needs its own explicitly reviewed touchset; this separately challenged edit-only slice has no parser/schema/evaluator/builder/
provider/SQL/dependency/import/sharing changes. No generic form framework refactor.

Reuse passive class-specific named-control pattern, guarded useActionState return
validation, actual official unstable_rethrow before ordinary-error classification,
auth page redirect + owner notfound, server-derived getUser and exactly-one
published-system `.single()`. Pending/immediate duplicate guard, controlled draft
and native-reset protection; reject/missing/malformed creates become uncertainty,
Check Homebrew + explicit local acknowledgement required before another manual
create. No auto retry/success inference. Edit conflict/uncertainty locks until
explicit reload with draft-loss copy. Correlate saved id/version/operation before
client navigation and retain confirmed identity if navigation fails. Returning an
unchanged result stays editable. Revalidate Homebrew/Library/detail only on
confirmed changed save. Effects/snapshots/grants are never application writes.

## Measurable acceptance and adversarial controls

1. Diagnostic pure fixture original Lantern Keeper, explicitlyd8/profile, raw dataexactly
   above20 rows; actual canonical definition/snapshot parsers admit it without
   stored defaults. Pure existing consumers at EACH level1..20 return slots
   available+empty, no pact/source activation,20 ordered empty class rail rows and
   no pending choices. AtCON10/free-choice, HP levels1/2/20 is8/13/103 through
   actual computeMaxHp; resolve hit-die pools from the same explicit pin. No missing
   class fallback accepted as the positive proof. Character persistence is mocked. This diagnostic does NOT authorize the zero-grant NEW product. Before NEW, add an actual two-class counterexample proving only the accepted primary-role class contributes save grants; race/feat/feature saving grants survive, reordering/removal/copy match accepted role policy, and missing/wrong/duplicate pins fail closed without current-catalog fallback.
2. Reject invalid/nonfinite/zero/fraction/unsupported die, unconfirmed profile,
   extra effects/proficiencies/features/caster controls, duplicate/File controls,
   UTF-8 transport or aggregate data oversize. Assert zero attempted writes.
   Conditional NEW completeness helper rejects19/21/duplicate levels, missing/null-confused
   casting, invalid/duplicate/nonmember save subsets or declaration/effect disagreement,
   and any nonempty general proficiency/feature/prerequisite array. Counterexample:
   sparse schema-valid class with top-levelnull but missing row casting is unavailable
   in actual slot resolver; complete rows must not be fabricated during edit.
3. Imported synthetic class has all20 valid casting rows and distinct ordered
   effects, raw tool/armor/weapon/choice/extensions/sourceRefs and absent optional
   fields; rename/description change produces exactlynext version with untouched
   raw metadata. Additional historical sparse/reordered canonical class and pact
   class keep their exact data/absence; parser defaults are not persisted. Invalid
   known effects/data fail before UPDATE. Genuine no-op/exhausted/corrupt return,
   same-old-version reply and stale CAS have precise distinct outcomes.
4. Mocked DAL throws on any RPC/table write except content_definitions. Assert no
   characters/contentrefs/featuregrants/spellgrants/acquisition/inventory/snapshot
   writes. Exact published system0/2rows, signed-out/foreign/retired/shared/type/
   system mismatch, forged owner/version/slug or unsupported parent input refuse.
5. Mounted actual form tests guarded rejected/undefined/malformed responses,
   native reset, pending duplicate, manual-check/relock, confirmed navigation failure,
   no-op and read-only imported mechanics. Separate root-run actual offline browser
   desktop1280/mobile390 with current production CSS/fonts and keyboard/overflow
   checks; simulated actions cannot prove database authority.
6. Narrow npm tests (new focused set + affected Homebrew and existing class rail,
   slots/effective sources/HP regressions), npm typecheck/lint; independent source
   review then root combined check/build/offline UI. Real authenticated owner,
   foreign/anonymous denial, ordinary CAS race, trigger-created v1/v2 immutable
   snapshots, historical selected pin stayingv1 after authoringv2, and actual
   selectable-class/pin/no-unintended-grants workflow require separately approved
   runtime/DB fixture authority. Starting-equipment paths retain their own gate.

## Smallest separate R06 class-role proof plan

R06 evidence-first prerequisite, independently challenged before implementation:

1. Reproduce the current leak with two original exact class pins: primary save
   strength grant, secondary save dexterity grant, base abilities10 and totallevel2.
   Use schema-valid renderer grants `saving_throw_strength` and `saving_throw_dexterity` for this failing-before control. Current sheet/builder flattening gives both class grants to evaluator; under
   actual getSaveModifier with canonical2014 proficiency bonus2, dexterity save receives+2 despite belonging
   only to the secondary class. Expected role-correct dexterity save has no class
   proficiency bonus. Use actual published2014 published ability/proficient keys and actual renderer contract; do not require six absent derived-save definitions, not a
   replacement synthetic calculator. Separate fixture gives dexterity grant from
   an independent feat/race: that grant must survive filtering. No unrun test is
   represented as a reproduced PASS/FAIL in this planning child.
2. Inspect acquisition evidence before implementing role selection:
   `CharacterChoices.classes` in `lib/types/character.ts` stores ONLYslug/level/
   optionalsubclass, no occurrence identity/acquisition order/starting-role receipt.
   Builder `handleSelectClass` writes current choices then separately inserts pin
   context `{source:class,level:1}` through content-refs-client; it does not record
   immutable primary status, and every added class has level1. Reference created_at
   orders pin insertion, not original class acquisition; deletion/reinsertion/copy
   can change it. content-refs.ts parses created_at/context/choice_source, but they
   are not validated primary-role authority. Do NOT infer role by minimum date,
   present array order, HP roll absence, highest level or current catalog.
3. Staged equipment evidence `supabase/staged/starting-equipment-transaction.sql`:
   awarded canonical_intent.sources.class stores exact class id/version, and commit
   checks it against choices.classes[0] at EQUIPMENT AWARD. receipt itself has
   grant_id/inventory_ids/plan/awarded_at, no class role. That proves the equipment
   source at award, not necessarily first character-level acquisition. Stage is
   default-off and runtime-unaccepted. Copy inherited_completion deliberately has
   NULLcanonical_intent/receipt; it is not a substitute role proof. Do not enable
   stage/derive a primary role from this artifact in class authoring.
4. Latest immutable copy source `20260722221534_atomic_background_selection.sql`
   copies choices and remaps exact source refs/manifests, preserving context and
   content versions. It does not establish an immutable original primary-class
   occurrence. The staged copy likewise preserves completion/provenance but loses
   awarded intent on inherited completion. No dependable universal legacy role
   anchor was found. Missing or ambiguous evidence must expose **role-dependent
   class grants unavailable**, preserving original saved choices/effects/pins;
   never quietly assign the current first class or manufacture a receipt.
5. Proposed correctness policy for challenge: class-granted starting saving
   proficiencies come from the class taken at CHARACTERlevel1, secondary class
   additions never gain that class's starting saves (D&D2014 multiclass rule).
   Reordering UI arrays cannot transfer that privilege. Copy must remap the exact
   proven origin occurrence/pin without rebasing to latest data. Removal of that
   originating class, class replacement/respec and a historical role that lacks
   sufficient evidence are MATERIAL lifecycle cases whose product contract is not
   established here. Fail role-dependent grants unavailable until that contract is
   accepted; do not invent permanent retention, automatic reassignment or a respec
   migration. Keep independent action/effect calculations available with clear
   unavailable save-role status instead of numeric zero masquerading as proof.
6. Producer requirement before NEW emit: authoritative first-class acquisition must
   atomically confirm ordinary owner + published system + exact entitled immutable
   class pin, selected class occurrence and immutable origin-role identity under
   existing character locks/revision/choices freshness. Existing separate direct
   choices and ref writers can bypass a browser-only marker; all relevant direct,
   legacy/remove/copy/import/reconcile writers must be fenced or integrated. A
   client-supplied `primary:true`/context or editable choice JSON is not authority.
   Concrete storage/RPC/DDL design needs a separate reviewed bounded proposal and
   appropriate runtime approval; this docs task does not choose a new live schema.
7. Collector after authoritative proof: pure provenance-aware reference collection
   filters ONLY class-definition starting save grants from secondary roles, with
   exact published six-ability/declared manifest stat_slug/proficient membership against the actual published+renderer save-key contract. Preserve raw
   definitions, relative effect order and independent race/feat/feature grants,
   narrative/mechanical effects and action consumers. Do not add a grant conditional
   format or modify generic evaluator. Role-unresolved output must be typed and
   handled by derived-save consumers, not silently represented by dropping effects.
   Initial source map: new `lib/character/class-role-effects.ts` pure contract/tests;
   sheet `app/(app)/characters/[id]/page.tsx` and builder class/abilities/race/
   background clients before their flattening; provider receives same accepted
   provenance-aware result and derives save availability consistently. Audit print,
   engine preview, durable model snapshots and copied character views for parity.
   Exact producer/writer files are a separate inventory gate before code, not hidden
   under that pure helper touchset. No source edits are authorized by this plan.
8. Measurable before/after cases: primary saves apply; same pinned class secondary
   saves do not; independent same-stat save grant survives; input class reorder,
   ref fetch reorder and copied/remapped refs preserve role; missing/duplicate/wrong
   system/foreign/unavailable origin pin reports unavailable; raw snapshot/effect/
   choice history remains byte-equivalent. Origin-class remove/respec stays an
   explicit blocked policy case until accepted. Current source has no role-safe
   compiler producer, so class form cannot emit any selected save grants yet.

## Required next children and rollout

R12/M4 remains OPEN: (a) real class proficiencies/skill choices and primary versus
multiclass semantics/effects compilation; (b) class/subclass level feature/ASI/
choice attachment with historical manifests; (c) private subclass authoring and
owned/entitled parent controls; (d) advanced class mechanics/explicit attacks/
improvements20-row editing and existing structured display fields; (e) parent/
subclass full/half/third/pact known/prepared/list/extra20-row casting, exact9-slot
rows, explicit null versus absence and pact single-tier invariants; (f) class/
subclass import scope and broader sharing under their own requirements. No
conventional slots, feat levels, prerequisites or proficiencies are autocalculated.

Class authoring rollout is blocked until the R06 role prerequisite is accepted; independent text-only editing would need its own bounded release and cannot count as NEW completion. No new create route is to be built under this plan. Later local authoring source is the conditional rollout; no new flag/dependency
or automatic migration. Disable/remove create link/routes on a failing consumer
contract rather than enabling a partial mechanics compiler. Rollback is source
revert only; never delete authored rows or rewrite immutable pins/versions. This
plan does not approve hosted operations, stage SQL, public publishing or beta.

## R06 amendment A — frozen origin producer, occurrence classifier and legacy behavior

This supersedes the earlier open storage/role questions for the FIRST proposed
contract. It remains docs-only and needs independent rechallenge before source,
staged SQL or runtime work. No new-class or edit-only workaround is authorized.

### Role policy and exact unavailable states

Starting saving proficiencies belong to the proven class occurrence taken at
character level1. UI order never changes that origin. New authoritative character
creation atomically starts `origin_status:draft` with fresh creation provenance; autosaved selections remain provisional. ONLY explicit starting-class confirmation seals one origin. Existing characters without such creation proof are LEGACY_UNAVAILABLE,
even if they currently have one class or an empty class array. Do not infer from
array position, level, reference date, equipment marker, HP roll absence or name.

Removing the origin occurrence, replacing its definition/version as a respec,
or removing/reinserting the same slug closes that occurrence permanently for
this first contract. Starting-save role becomes ORIGIN_REMOVED_UNAVAILABLE;
no automatic retention, reassignment or reactivation. Secondary removal/reorder
leaves a still-active origin unchanged. No respec/removal feature is added here;
existing removal may continue only through the guarded transaction with honest
unavailable save-role feedback. Future restoration/respec policy is separate.
A same-version text edit does not change a character pin; authoringv2 never rebases
originv1. Missing/wrong/duplicate active origin pin or invalid occurrence membership
is ORIGIN_PIN_UNAVAILABLE. Missing/ambiguous grant classification is
SAVE_OCCURRENCE_UNAVAILABLE. These are scoped role-dependent availability states,
not total-sheet failure, zero-valued proficiency or silently reassigned primary role.

### Proposed additive storage (names/fields frozen for challenge, no DDL now)

1. `character_class_origins`: character_id PK/FKcharacter; system_id; schema_version1;
   origin_status enum draft/recorded/legacy_unavailable; origin_occurrence_id
   nullableUUID (present ONLYrecorded), initialization_operation_id UUID; created_at.
   command_revision bigint0..9223372036854775807 starts0. No client DML. Initialize only inside trusted NEWcharacter/copy transaction.
   One draft->recorded or ->legacy_unavailable transition; thereafter identity
   immutable. Do not add origin evidence automatically to historical characters.
2. `character_class_occurrences`: id serverUUIDPK, character_id/system_id;
   content_id/content_version compositeFK immutable content_versions; class_slug
   verified from snapshot, acquired_character_level nullable integer1..20 (null while provisional or creation-plan secondary),
   acquisition_operation_id nullableUUID, selected_at, accepted_at nullable, ended_at nullable; lifecycle provisional/accepted/ended. No acquired history before explicit acceptance. Content/character/
   system/acquisition identity is immutable; only active->ended once via guarded
   removal. Unique active class slug per character; no timestamp-order inference.
   `choices.classes[].occurrence_id` links the SAME occurrence and exact pin; this
   is server-output metadata, never browser authority. OriginFK points to retained
   occurrence row, not a deletable content-ref row. Origin/content version survives
   remove/copy evidence without rewriting choices history or raw definitions.
3. `content_class_save_manifests`: content_id/content_version compositePK/FK;
   schema_version1, compiler_id fixed `private-basic-class-v1` (later compiler IDs
   need separate reviewed producers), saving_throws_snapshot ordered JSON array,
   effects_snapshot ordered full raw JSON array, occurrences ordered records
   `{effect_index, kind:starting_save|independent_save, ability, stat_slug, effect_snapshot}`.
   0-based index, unique/in-range; each effect_snapshot equals EXACT entry at index.
   Whole raw effect array and declaration must match immutable version JSONB;
   object-key order is immaterial, array order/type/value/duplicate positions matter.
   New minimal producer has<=6 starting entries and no independent entries; full
   manifest<=256 matching occurrences and<=128KiB serialized metadata, reject
   oversized without truncation. This is external immutable provenance, not a new
   effect conditional format or edits to effects_snapshot in existing versions.

Ordinary authenticated users have no INSERT/UPDATE/DELETE on these metadata
relations. Read only for existing character visibility and corresponding exact
version entitlement; no broadened snapshot RLS. Trusted routines derive actor via
existing account auth, verify owner/system/access and server-owned membership;
request must not accept occurrence IDs or compiler indices as trusted assertions.
No service-role path exposed to browser. Database grants/trigger fencing and
metadata-specific access must be part of separately reviewed staged implementation.
Append metadata and definition/version inside the SAME transaction, never a second
best-effort client write. Raw version rows remain controlled by existing triggers.

### Exact classification, including identical and class-level grants

Source namespace participation gap is explicit: transformer emits save_<ability>, but SavingThrows, concentration-prompt and print-model use saving_throw_<ability> through exact-match sheet/helpers.isProficient/getSaveModifier. No alias was found. Raw legacy keys are not normalized silently. The new compiler contract uses the actual renderer key saving_throw_<ability>, after validating published six abilities and proficiency/config participation; a legacy-save compiler needs separate attestation and consumer alignment before availability. The legacy save_ counterexample remains missing-participation evidence, not a claimed UI+2 regression.

The candidate tuple `type:grant, stat:save_<ability> OR saving_throw_<ability>, value:proficient` identifies a
role-sensitive candidate, NOT its origin. Classification requires exact trusted
manifest declaration/compiler occurrence pairing. For `private-basic-class-v1`,
server compiles one starting grant per explicitly selected ability in submitted
order; duplicate abilities rejected; stored manifest records its index/declaration
and raw entry. No arbitrary effect input or inference by searching matching stat.
Every save candidate in that version must have exactly one explicit starting_save
or independent_save mapping. A second identical tuple is a distinct occurrence,
not automatically redundant or starting: if producer provenance cannot classify
both positions, the version is unavailable for role-dependent saves. Historical
bare arrays, copied metadata with unmatched version/data, duplicate index mappings,
unmatched declaration, absent compiler proof or unexplained class-level save grant
are SAVE_OCCURRENCE_UNAVAILABLE. No automatic backfill by tuple equality.

Independent class-level saving grants MUST remain ordered and active even when
their class is secondary. Trusted future producers must explicitly label their
occurrence as independent_save; selected subclass/feature/race/feat grants have
independent source provenance and are never filtered as class starting grants.
Narratives, mechanical effects, non-save grants, actions, choice histories and
snapshot raw ordering remain unchanged. Text-only class edit may clone a trusted
manifest to newversion ONLYinside the same trusted version transaction and only
when original ordered effects, saving_throws and all raw data except description
are exactly unchanged. Otherwise refuse classification/require reviewed compiler;
never regenerate from defaulted parser output. Historical v1/pins/manifests stayv1.

### Separate collector child (C1), then producer/fence child (P1)

C1 owns pure `lib/character/class-role-effects.ts` + schema/tests only first.
Input has exact character/system, class occurrence evidence, origin header,
current selected occurrence/pins, version manifests and ordered source refs.
Result contains original ordered sources/effects untouched; ordered evaluation
projection filtering ONLY trusted secondary starting_save indices; typed
saveAvailability per canonical ability and explicit unavailable occurrence reasons.
Ambiguous candidates remain in original evidence and are not silently dropped.
For unresolved affected saves, no numeric computed save is presented or actionable;
other independent calculations remain usable. A known independent grant remains
in projection even if a separate ambiguous candidate makes that save unavailable.
No engine grant format/formula change; no UI/router/DB in first pure C1.

Only after C1 source review, producer/fence P1 is planned against exact writers:

| Existing source writer at b4e308f | Required fence/adapter before enabling |
| --- | --- |
| `characters/new/actions.ts:createCharacter`, `lib/supabase/characters.ts:createCharacter`, staged create_character_with_starting_grant | Trusted transaction creates explicit draft origin header only for genuinely new character; incoming nonempty classes/origin metadata rejected unless reviewed privileged import/copy. Legacy INSERT cannot mint proof implicitly. |
| `class-step-client.tsx:handleSelectClass` choices write then insertContentRef | Replace separate steps with ordinary-owner atomic class-acquisition RPC, validating freshness/access/pin/occurrence with provisional selection under authoritative draft status. Server creates UUID; only explicit confirmation seals starting origin at characterlevel1; preconfirmation selections carry no inferred acquisition history. No browser primary flag. |
| handleLevelChange/handleConfirmLevelUp and handleSubclassSelect | Guarded same-identity occurrence patch under character lock; preserve origin/pin identity. Subclass exact parent/version provenance unchanged. Level changes cannot rewrite acquisition history. |
| handleRemoveClass + content-ref deletion | Atomic end-occurrence/choice/ref update; originating removal computes unavailable, never elects next class. Reinsert same slug gets NEWsecondary occurrence when origin exists; closed origin remains closed. |
| handleHpRollChange/handleChoiceSelect/handleFightingStyleSelect, race/background/equipment whole-choice updates | Existing nonclass writes may pass only if their class-occurrence/pin identity is unchanged from locked current row. Stale whole-choice writes conflict/reload rather than restore class metadata; no ASIwriter architecture change. |
| `character-client.ts:updateCharacter/updateCharacterAndReturn`, `characters.ts:updateCharacter`, direct PostgREST UPDATEchoices | Database fence rejects protected class membership/origin/occurrence mutations outside guarded routines, including reorder with omitted UUID, deleted original metadata and ABArestore. Nonclass patch must not overwrite class subtree. |
| `content-refs-client.ts:insertContentRef/removeContentRefById`, `content-refs.ts:addContentRef/removeContentRef/removeContentRefsByChoiceSource`, direct INSERT/UPDATE/DELETE/reparent class refs | Character-row lock plus class occurrence/pin fence; no unassociated class pin can establish role or bypass transaction. Nonclass refs retain existing behavior. Missing association is unavailable, never latest-catalog repair. |
| `class/actions.ts:reconcileClassFeatureRefsAction`, feature-refs-server syncClassFeatureRefs, DB sync_character_feature_refs | Restore earned FEATURErefs from existing manifests only; no origin creation/reclassification/class-pin swap. Cannot repair a lost class origin through latest catalog. |
| latest copy_character in20260722221534_atomic_background_selection.sql + staged starting-equipment copy | Copy exact evidence and remap occurrence/ref IDs atomically. Proven active origin remains same original pin/version; ended/unavailable/legacy remains unavailable. Copies do not initialize a sealed starting class by target array order. Existing feature/ASI/spell grants/history and equipment provenance unaffected. Both SQL definitions must share reviewed role adapter before staged gate. |
| Existing ability/ASI/background RPCs and source promotion/import/admin writes | Fence only protected class identity when their merged row changes it; do not rewrite their independent action contract. Current MPMBspell/feat importer creates no classes; future class imports need authoritative classification metadata or explicit unavailable. Backup/restore must restore origin/occurrences/manifests together, never infer omitted metadata after restore. |

P1 request contract: characterId, operationId UUID, operation add/set-level/
set-subclass/remove/reorder, requested entitled contentid/version and bounded
operation fields, expected current choices/class-ref identity/revision. Lock
character first, then exact pins/metadata in deterministic IDs; reread policy and
access after lock; commit occurrence/origin/choices/ref as one result. Operation
identity replay returns the same committed occurrence/result after current owner
check, with changed-intent rejection. No automatic retry after lost transport.
Revision/command-receipt storage is frozen below; exact stagedSQL/permissions and real role gates must be independently accepted. Present helpers do not provide it. Until those gates pass, P1 stays OFF and no class creator can
emit starting-save grants. No unreviewed migration filename or live execution.

After producer storage acceptance, C2 wires same collector at all flattening
boundaries: sheetpage, builder class/abilities/race/background, provider; components/sheet/saving-throws.tsx and concentration-prompt.tsx, lib/sheet/helpers.ts save availability boundary, lib/character/print-model.ts and character-print-view.tsx. Plain class content-preview may display declared starting saves, clearly distinct from current-character effective saves. Print/current preview parity required. R09 injected
mechanical model uses original ordered snapshot inputs until separately reviewed
alignment; do not silently change its parity in this prerequisite. Existing ASI,
weapon/armor, HP/equipment calculations and independent actions stay intact.

Required finite failure controls: two indistinguishable same-stat legacy grants;
one starting and one independent class-level grant from trusted manifest; secondary
class suppresses ONLYstarting index while independent survives; independent feat/
race/feature save grant survives; declaration/index/array-order/version tampering;
missing/ended/original-role evidence; remove+reinsert/reorder/copy/legacy emptyclass;
wrongowner/system and corrupt associated pins. Current source leak remains a
failing-before example, not a claimed executed regression. Real authenticated
DML denial, transaction rollback/concurrency, durable replay, privilege fencing
and restore/copy evidence require their separately approved DB/runtime gate.

NEW class authoring follows C1+P1+C2 acceptance, not before. Local C1 does not prove
storage authority; P1 does not prove UI availability; C2 cannot derive missing legacy
history. Remove/respec first contract is conservatively unavailable; no open-ended
respec feature or historical guessing is hidden under canon correctness.

P1 replay/revision detail (frozen logical storage, staged source not yet approved):
`character_class_commands` has PK(character_id,operation_id), schema_version1,
canonical_intent JSONB, applied_revision bigint, result JSONB, accepted_at and
current transaction marker during acceptance. Origin header command_revision
increments exactlyonce per accepted class mutation; exhausted bigint refuses
new commands but permits receipt replay. Request expectedRevision is decimal
string0..9223372036854775807 (no leadingzero except0); compare after lock before
mutation. Owner checked before receipt lookup; existing same-id/same-intent returns
immutable result, changed intent rejects, then current access checked for fresh
acceptance. Intent equality is normalized JSONB object-key-insensitive/array-order-
sensitive; exact raw grant manifest arrays remain significant. Command payload
<=32KiB with<=20 class occurrences; no raw choice/effect/schema authority input.
Result records accepted occurrence IDs, origin availability and applied revision,
not a stale replacement of all choices. Replay whose current revision has advanced
requires current server read/reload before UI adopts choices, not an old absolute
write. Receipts persist for character lifetime, protected from ordinary DML.

Proposed routine `public.apply_character_class_command` is ordinary authenticated,
derives actor from auth.uid(), verifies actual owner and system, then locks the
character+origin header and relevant occurrence/pin/manifest rows in stable UUID
order. Explicit confirm_origin requires genuine fresh draft header, exact selected provisional pin/manifest and current owner/freshness; autosaved selection never elects origin. Confirmation accepts the chosen starting occurrence at characterlevel1.
It patches ONLY current locked choices.classes subtree/required level and related
exact refs; preserve other choice keys/ASI history subject to EXISTING legitimate
level-pruning triggers. Guarded routines create command acceptance marker/planned
before-after identities in protected storage for the same database transaction;
protected class DML fence matches old/new rows, transaction and accepted command.
Do not trust a caller-set GUC, primary boolean, service-role browser request or
current_user alone to waive a fence. Unrelated nonclass updates are allowed only
when protected class identity is unchanged. Commit closure checks exactlyone
class ref per active occurrence and origin identity consistent with sealed metadata.
No partially minted role receipt after a failed choice/ref write. Copy/create use
reviewed internal bootstrap routines for the same storage, not origin inference.
The exact privilege owner, marker/deferred closure triggers and SQL role tests are
part of the P1 staged implementation challenge before execution; naming them here
is not DDL or deployment authority.

C1 inputs/results are service-internal pure contracts, not browser authority.
Both applied/current/expected revisions cross TypeScript/PostgREST boundaries as
validated decimal strings; no bigint conversion through JavaScript number. Pure
positive fixtures inject trusted evidence only to test rules and never prove the
producer exists. Header identity is immutable once sealed; command_revision is
its explicitly allowed monotonic mutable counter under guarded commands. Copy
remaps origin_occurrence_id to a target occurrence with copied exact version and
original acquisition identity/provenance; it never changes source header/receipt.
Origin removed/unavailable state is preserved even if copied current choices now
start with a different active class. A restored partial backup with no provenance
returns unavailable; no automatic historical attestations or current-array repairs.

## Amendment B — explicit starting-class confirmation, not autosave acceptance

Supersedes any earlier statement that a first saved selection seals origin.
Actual `characters/new/actions.ts:createCharacter` immediately opens editable
builder; `ClassStepClient.handleSelectClass` autosaves choices/pin, removal/revision
is normal, and Previous/Next/overview navigation has no creation-finalize event.

Fresh provenance header is created INthe authoritative new-character transaction:
`origin_status:draft`, `creation_provenance:new_character|fresh_draft_copy`,
`creation_operation_id:serverUUID`, optional `source_draft_operation_id` only for
trusted provisional-copy lineage, schema_version1, command_revision0. Creation
marker cannot be added later by client/direct INSERT/reload/restore. Legacy row
with absent proof stays LEGACY_UNAVAILABLE even if empty or one-class. Origin
occurrence is null until confirmation. Draft occurrence rows have lifecycle
provisional, selected_at and exact pin identity; acquired_character_level,
acquisition_operation_id and accepted_at are null. Provisional choices are not
historical acquisitions. Removed provisional rows are retained ended evidence;
selecting a replacement creates a fresh provisional occurrence. No zero-grant
placeholder class or automatic confirmation is added.

Concrete UI in class builder, next to existing Class heading before ClassStepRail:
new `components/builder/starting-class-confirmation.tsx` section, six-field-free
starting-class selection from currently saved provisional class occurrences,
one radio per actual name/version/pin, blank selection initially, summary and
button **Confirm starting class**. Copy states that class picks auto-save as drafts;
confirmation fixes starting saving proficiencies, and later removal/replacement
makes role-dependent saves unavailable. User deliberately chooses the starting
occurrence, not an inferred first item. Show explicit order/HP consequence:
confirmed starting class will occupy the first class position for the existing HP
contract, preserving all other draft classes in relative order. This is part of
explicit reviewed confirmation intent, never a background array reassignment.
Other builder steps/navigation/reloads do not confirm or require guessed class role.
Legacy/unavailable rows show reason with no confirmation control or reseal path.
Confirmed rows show immutable chosen identity/version; button cannot repeat with
new identity. Pending duplicate guard, lost/rejected/malformed result uncertainty,
manual reload and receipt replay use actual guarded response patterns; no auto retry.

Concrete action `confirmStartingClassAction` in existing builder/class/actions.ts
calls proposed public.apply_character_class_command with op `confirm_origin`,
characterId, operationId, expectedRevision and selected provisional occurrenceId.
This ID is REQUESTselection only: DB derives actor, validates fresh draft provenance,
current owner/published2014 system, exactly one selected provisional occurrence,
matching exact entitled immutable pin/manifest, revision and explicit confirm intent.
Under the same locked transaction it seals header, accepts chosen origin occurrence
at characterlevel1, accepts remaining planned classes as secondary creation-plan
occurrences (no invented acquisition levels), and performs only the explicitly
confirmed class ordering adjustment. Never seal merely on class-select/level/subclass
write, opening sheet, equipment award, array ordering, timestamp or copy.
Wrong/missing/stale/foreign/ended/nonselected occurrence refuses without partial
seal. Same operation+intent replays immutable confirmation after owner check;
changed intent or different-origin confirmation after sealed header rejects.
For a sealed character, reorder cannot move the accepted origin out of its first
HP position while active; this preserves current HP contract and never defines
origin from array order. Origin removal retains the already frozen conservative
ORIGIN_REMOVED_UNAVAILABLE policy, without reseal or automatic privileges transfer.

Draft copy: source with genuine draft provenance produces a target fresh_draft_copy
header and remapped PROVISIONAL occurrences, no origin; both copies may independently
revise/confirm their own drafts. Copy of recorded origin remaps/preserves recorded
origin and its ended/unavailable state, never turns it into editable fresh evidence.
Legacy copy stays legacy unavailable. Partial backup/restore missing marker or
manifest stays unavailable; no new draft status from sparse saved data. Fresh
provisional saves/readbacks can display declared choices/HP/other independent
mechanics, but role-dependent starting saving grants remain DRAFT_UNCONFIRMED until
this action commits. Known independent class-level/feat/race/feature grants remain
ordered and intact; only affected role-dependent save values/actions are unavailable.

Exact renderer compiler key is `saving_throw_` + validated ability slug. Require
exactly six UNIQUE published2014 ability definitions with the expected slug set,
one proficient proficiency definition with multiplier1, and actual current finite
computed proficiency bonus at the save consumer. NO six matching derived_stats
membership requirement: seed does not have those six save definitions. Do not
invent them, calculate replacement PB or fall back to zero. `save_<ability>` is a
separate legacy raw namespace, unavailable until its explicitly attested compiler
and consumer participation are reviewed; no silent prefix rewrite/alias. Starting
versus independent occurrence classification still requires the exact manifest
pairing; stat spelling alone never classifies role.

Finite lifecycle controls to add to C1/P1/C2 tests before enabling: newchar marker
atomically present; selectA->removeA->selectB, revise levels/subclass, reorder,
reload/open sheet/overview and draft copy ALL leave origin unsealed; B confirmed
explicitly with no A privilege retained; no preconfirmation role-dependent saves;
wrong/stale/duplicate confirm never partially seals; confirmation lost response
replays same identity; postconfirm remove/reinsert/respec becomes unavailable;
recorded copy preserves identity and draft copy stays independently provisional;
legacy empty/singleclass marker absence cannot confirm; direct choices/ref/origin
writes cannot inject or reseal marker. Independent known grants survive draft and
unavailable states. Extra/duplicate/missing ability definitions, multiplier other
than1, nonfinite current PB and legacy-prefix mismatches fail exact renderer-key
admission. Actual save renderer/CON concentration/print handle unavailable state
consistently. Pure C1 is neither a live role fix nor NEWclass completion; P1 storage
and ALL writer fences plus C2 actual integration are required first. No code/SQL/
heavy/runtime operation is authorized by this amendment.
