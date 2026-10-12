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
   NEW completeness helper rejects19/21/duplicate levels, missing/null-confused
   casting, any nonempty save/proficiency/feature/prerequisite array. Counterexample:
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
   Current sheet/builder flattening gives both class grants to evaluator; under
   canonical2014 proficiency bonus2, dexterity save receives+2 despite belonging
   only to the secondary class. Expected role-correct dexterity save has no class
   proficiency bonus. Use actual published2014 derived-stat/config keys, not a
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
   exact published six-ability/save_<ability>/proficient membership. Preserve raw
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
