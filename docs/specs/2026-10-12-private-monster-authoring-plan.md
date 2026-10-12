# R16.2 private monster authoring — bounded plan for challenge

Documentation only, 2026-10-12 UTC, `codex/r16-monster-foundation` in isolated
`r16-monster-worker`. Foundation worker `7e25581` / root `cda325a` is accepted
source; its actual browser/permission/persistence acceptance remains open.
Harness `09f6af3` and receipt correction `2ebf857` stay separate and immutable.
No authoring implementation, install/test/browser, database operation, migration,
seed, importer, sharing API, campaign instance, dependency or hosted write is
performed or authorized by this plan. Root independently challenges it first.

## Existing source to reuse, not widen

| Source/function | Concrete contract for this child |
| --- | --- |
| `lib/schemas/content-types/monster.ts`, [foundation contract](2026-10-12-monster-foundation-contract.md) | Exact strict format 1, all declared fields, ordered bounded lists and 64 KiB validated-data budget. No schema expansion, aliases, defaults, nulls, formula execution or normal-form JSON textarea. |
| `lib/supabase/homebrew-weapons-server.ts:167,189,214,260,355` | `listOwnedHomebrewWeapons`, `getOwnedHomebrewWeapon`, create/update and missing-update classification use `auth.getUser`, ordinary account client, exact owner/type/system/source/personal/active filters. Update reads the exact expected-version raw row, overlays controlled fields and repeats all filters plus version on the UPDATE. Adapt this pattern for monster; do not extract/refactor every family. |
| `lib/supabase/homebrew-items-server.ts:213,259` | Server resolves exactly published `dnd-5e-2014` via `.single()`, creates private envelope/slug itself and updates only name/data. Item's complete-data replacement is not a preservation template for a partial monster draft. |
| `lib/supabase/homebrew-races-server.ts:251`, `lib/homebrew/race-authoring.ts` | Raw data/effect metadata must be validated without serializing stripped parser output over the original. Monster authoring does not need race effect ownership annotations: it never writes effects on edit or derives mechanics from them. |
| `app/(app)/homebrew/items/actions.ts`, `weapons/new/page.tsx`, `weapons/[id]/edit/page.tsx` | Actions authenticate, create/edit pages redirect signed-out users, edit lookup is owner-filtered/not-found. Revalidate Homebrew/Library only after confirmed success. No service client, owner claim from browser, public route or permission RPC. |
| `components/library/item-form.tsx`, `weapon-form.tsx` | Existing controls, `useActionState`, retained drafts, pending submit lock, stale-version conflict + explicit reload and cancel. Monster needs ordered structured sections rather than an advanced JSON-only editor. |
| `app/(app)/homebrew/page.tsx:27,91,329` | Add one owned-monsters family to existing settled list/error/empty-state handling, Create monster entry and Edit/View links. Preserve every existing family and importer label. Homebrew remains authoring; Library is the shared canonical read view. |
| `lib/supabase/content-definitions-parser.ts:57,157`, `compendium-server.ts` | Created/updated valid private monsters use existing canonical current detail/list. Existing immutable snapshot parser supplies historical data, not latest-parent substitution. There is no current monster campaign instance/pin UI to reuse. |
| `supabase/migrations/20260720171627_content_version_pinning_and_rls.sql:150,196,239,392,401,559` | Existing generic owner homebrew DML, immutable identity, database-managed version and self-contained snapshot trigger. This child uses existing boundaries; it neither executes nor changes them. Actual deployed grants/triggers/RLS still need authorized runtime proof. |

## Normal structured form, complete format-one coverage

New `MonsterForm` uses existing labels/inputs/fieldsets/buttons and readable
collapsible optional groups. No JSON text editor is the normal flow. All required
fields begin blank/unselected on create; no prefilled 10 abilities, 30-ft. speed,
AC, HP, alignment, DC, cost or challenge. Display preview uses the real read-only
stat block **only after** canonical validation succeeds. Invalid draft stays
editable with inline errors, without a fabricated preview.

| Group | Player-facing controls |
| --- | --- |
| Identity and description | Name (1..100 non-whitespace characters), Size select with unselected placeholder, creature type text, optional alignment and multiline description. Read-only game-system label; no owner/scope/source/version selector. Existing longer envelope names remain read-only discovery-compatible, but this bounded authoring form requires an explicitly valid <=100-character name before save; no silent truncation. |
| Defense and vitality | Required declared AC and HP average; optional AC notes and displayed HP dice text. Explanatory copy says dice text is displayed and does not calculate the average. |
| Movement | Six named mode controls, optional speed notes and Hover select `Not specified / No / Yes`; at least one speed must be declared. Empty is absence, explicit `0` remains zero, hover requires declared flight. |
| Abilities and saves | Six required named score controls; individually optional declared save bonuses. Preview may show fixed score modifiers, but declared save/skill/attack bonuses never receive extra computed bonuses. |
| Skills, senses, languages | Ordered add/remove rows with skill label/bonus; existing sense enum/range/notes; optional passive perception and senses/language notes; ordered language rows. No free-form numeric array, inferred perception or language grant. |
| Challenge and defenses | Optional challenge label/XP; typed ordered damage defense selections using existing taxonomy, optional conditional defense notes, ordered condition labels. No CR calculation or new condition taxonomy. |
| Traits, actions, bonus actions, reactions | Ordered named entries with description; optional structured attack kind/type/to-hit/reach/range/target, save ability/DC/success text and ordered typed damage average/display-roll/notes. Traits expose only the supported plain name/description shape. |
| Legendary and lair | Optional section enable/disable, description, declared legendary count and per-entry cost, declared lair initiative (including zero), ordered rule entries. No implicit 3/1 legendary values or lair initiative. |

Rows expose **Add**, **Remove**, **Move up**, **Move down** with accessible names,
keyboard buttons and disabled boundaries. UI-only stable row IDs never enter
canonical data; distinct duplicate names remain valid and ordered. Every group
has the exact schema maxima, integer ranges and text limits. Optional group
presence is explicit: existing absent and present-empty arrays initialize
differently and survive unrelated edits; removing a group is a deliberate
unsaved draft action, not automatic serialization cleanup.

Transport fields are exactly `name`, `monster_data`, and on edit `id`,
`expected_version`, `changed_fields`. `monster_data` is hidden serialized
**structured control data**, not an authored JSON field. A draft adapter converts
only explicit decimal-integer input syntax to numbers; required blank stays
invalid, optional blank means omission, zero stays zero, decimals/exponents/
nonfinite values fail. Checkbox/select choices are explicit booleans or absence.
Server always revalidates typed data through the canonical schema, including
aggregate bytes; browser validity is never authority. Before JSON parsing,
cap serialized data/intent transport at **128 KiB UTF-8**; decoded data still
must meet **64 KiB**. Invalid JSON, File/duplicate control values and oversized
requests return bounded field errors without invoking a mutation.

The server derives literal schema_version 1 on create; it does not accept a format
upgrade from the form. `changed_fields` is a unique bounded list of declared
top-level editable data keys, excluding schema_version. It records actual group
edit/clear intent; it is not an ownership or authorization flag. Edit identity is
UUID plus positive decimal expected version in PostgreSQL integer range
1..2,147,483,647. Client-supplied system/type/owner/source/scope/effects/slug/version
claims are never used in INSERT/UPDATE construction.

## Preservation and unsupported-data boundary

Edit reads the **raw, owned, active, personal, canonical-system, expected-version**
database row on the server. Validate envelope, strict monster data and existing
effect-array schema without replacing raw JSON with stripped parser output.
The browser receives only validated monster control data/name/id/version; not
effect arrays or privileged metadata. Clone raw data, then replace/remove **only
explicitly changed** allowed top-level groups. Unchanged groups, original text,
ordered entries and absent/present-empty distinctions stay exactly as stored.
For changed groups the complete structured draft is authoritative after
validation, so removal/reordering is explicit. Required groups cannot be cleared.
Compare unchanged groups using JSON structural equality that ignores object-key
order and preserves array order; changes outside `changed_fields` are refused.
Validate the full merged payload again, then persist the raw-preserving merged
object. Do not persist a stripped projection.

**Effects are never in the UPDATE payload**, so valid raw effect fields, order,
tags, conditions and extra metadata stay database-identical. Existing immutable
envelope columns, unrelated row metadata and all snapshot rows are untouched.
Changing declared AC/HP/etc. does not synthesize/delete/repair an envelope effect
or promise an automated monster engine. Create uses explicit `effects: []`.

Important constraint: format 1 is strict. An out-of-band unknown root/nested
data key, future schema_version, unsupported mechanics or malformed effect cannot
be admitted as an editable monster by pretending it was preserved after stripping.
Such records are **not written**, upgraded, normalized or partially repaired by
this child. The authoring family surfaces an unsupported/load failure (existing
per-family behavior); other Homebrew families stay available. Library already
omits malformed records individually. A schema-supported but initially collapsed
optional group is preserved; an unknown extension is refused, not deleted.

Unsupported controls remain explicit: arbitrary formulas/functions/HTML,
automated spellcasting/slots/charges/recharge/resolution, PC grants/effects,
condition automation, source-reference extensions outside v1, multi-system
formats, imported metadata contracts, sharing/publication and DM instances.
Narrative can describe a rule, but this form does not execute it. No new schema
extension is proposed to hide any of these limits.

## Server mutation and discovery contract

New `lib/supabase/homebrew-monsters-server.ts` owns owner list/get/create/update;
`lib/homebrew/monster-form.ts` owns bounded draft/request mapping and merge-intent
validation. New routes/actions under `/homebrew/monsters/new` and
`/homebrew/monsters/[id]/edit`; `components/library/monster-form.tsx` owns the
normal structured UI (bounded subcomponents in the same family if needed).
Existing Homebrew list changes only add this family. Existing monster Library/
detail remains the read surface; add no parallel catalog, historical-management
UI, mutation route there, sharing RPC, schema change or migration.

Create: authenticated server context; exact published canonical system; validated
name/data; server-generated slug/UUID; `content_type: 'monster'`,
`source: 'homebrew'`, `scope: 'personal'`, actor owner. Do not send a database
version or snapshot insert. Validate confirmed returned canonical row before
success; a successful standard create expects database-managed version 1.
No automatic retry, upsert/overwrite or duplicate-saving while pending. A lost
or malformed write response is not proof of rollback/exactly-once creation;
message requires checking owned Homebrew before another create attempt. Durable
creation idempotency is not claimed by this existing boundary.

Edit: both read and final `.update({name,data})` repeat exact id/owner/system/
type/source/personal/non-retired/**expected version** predicates. Final CAS
protects against changes after the raw read; no latest-row read to silently
rebase/overwrite a draft. Zero returned rows trigger owner-filtered existence
classification: current owned eligible row -> conflict, inaccessible/wrong type/
shared/SRD/retired/missing -> generic not-found, database error -> bounded error.
Foreign content/version is not disclosed. Client version is validated, not trusted
as database authority; trigger alone advances it and snapshots accepted changes.
No-op intent/name returns idle `No changes to save.` without UPDATE or false
new-version redirect. Success revalidates owned list, Library and current detail;
existing action redirect conventions may be reused with confirmed returned ID.

Pending locks submit; validation/recoverable errors retain the full draft and
ordered rows. Conflict retains draft, disables another save and offers explicit
Reload latest (with clear draft-loss consequence) or Cancel. Reload uses the
fresh owned row/version; it never resubmits automatically. No hidden recovery
loop, claim of database durability, delete or permission widening.

Historical pin controls in this scope are preservation controls: UPDATE contains
only name/data; no character refs/inventory/spells/rolls, monster instances or
snapshot writes, and no automatic latest-version substitution. Edit copy says
`Changes save a new version. Older versions remain unchanged.` Do not advertise
existing monster PC/campaign pin-management UI, which does not exist. Actual
old-snapshot stability/trigger effects need authorized database acceptance later.

## Finite acceptance plan and rollout limits

| Layer | Required evidence |
| --- | --- |
| Pure mapper/merge tests | Original three fixtures through structured draft round-trip; blank required vs absent/zero/negative optional numbers; all groups and duplicate order; body/data byte boundaries, invalid JSON/File/duplicates/privileged claims, ID/version bounds; explicit group clear and no-op; unchanged optional/present-empty/text/groups preserved; unknown extension/future format/invalid mechanics rejected without mutation. |
| Mocked server tests | Missing auth, zero/duplicate/unpublished system, foreign owner/wrong type/source/system/shared/retired/malformed row; exact private INSERT and version-free payload; raw expected-version read and same final CAS filters; race after read gives conflict with no broad retry; effects/envelope/snapshots omitted; preserved raw effect extras/order; no-op performs no UPDATE; missing/malformed write response never counts as confirmed save. These are query/logic tests, not real RLS. |
| Action/page/list tests | Signed-out create/edit redirects; malformed/foreign IDs not-found; owned list/create/edit/detail links; correct revalidation only after confirmed success; isolated monster load failure; current canonical Library shows parsed original private row; unchanged other families. Historical v1 parsed snapshot stays exact when separate v2 data/name differ. No campaign/PC pin writes. |
| Form tests | Normal labels/controls for every group, explicit no guessed defaults; stable ordered duplicate rows Add/Remove/Move; errors focus/reveal relevant collapsed section, retain draft; zero values and optional presence survive reload; pending/conflict lock, explicit reload, validated real stat-block preview and read-only unsupported state. No JSON-only normal form or raw effect editor. |
| Released offline browser | Actual MonsterForm + canonical mapper/preview/detail; original small/all-fields/>60 KiB fixtures; create/edit simulated action flow, keyboard section/row ordering, validation/retry/conflict/reload and mobile long-text wrapping using current verified root CSS/fonts. Simulated transport/storage labeled; no hosted/default E2E. |
| Later actually authorized runtime | Real owner create/read/edit/current detail; second owner and signed-out denial by ID and direct DML; stale expected-version update/overlap; version 1 snapshot exact after successful version 2 and nonempty raw effects unchanged; deployed grants/triggers/RLS and source availability verified. No automatic SQL execution or inferred G2 approval. |

After independent challenge and resource release, implement only named scoped
files, focused tests with maxWorkers 2, existing typecheck/lint scripts, then
reviewed offline browser. Root owns combined check/build/source review and
actual-authority acceptance. Heavy/install/test/browser hold remains now.
Rollback reverts this additive local authoring slice, not content/snapshot rows;
read-only foundation remains. This plan neither accepts private persistence nor
completes monster import, sharing, DM use, R16 or full M5.
