# R12.4 private race authoring: bounded first-child plan

Plan v1, pending independent challenge. Inventory base: `edac6d7942c9152e60d7c462468b1a694bf979a4`; branch `codex/r12-private-race`; isolated workspace `C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r12-race-worker`. This checkpoint changes this document only. No application code, installation, tests, browser, provider, evaluator, schemas, dependencies, SQL, migrations, or remote state changed.

## Recommendation

Implement **private race identity/descriptions/size metadata and walking speed** first. Keep `content_type = race` and published `dnd-5e-2014`; use the system's race/species display label without renaming types or systems. Do not expose ability bonuses, traits, subraces, grants, choices, or advanced movement as working authoring controls in this child.

Walking speed is not metadata alone: generate one server-owned `mechanical` effect targeting `movement_speed`, operation `set`, with the validated numeric speed. Store the same value in `data.speed` and `data.speed_detail.walk`. Size remains canonical metadata displayed by the builder; **do not** emit the SRD transformer's string-valued size effect into the numeric evaluator. Language description is prose, not a language grant.

## Actual contracts and consumer gaps

| Evidence | Observed contract or inference |
| --- | --- |
| `lib/schemas/content-types/race.ts` | Required size from `CREATURE_SIZES`, positive integer speed; four description fields; slug arrays for traits/subraces/languages; optional six-int scores and movement detail; vision/resistance/save-note/proficiency/source-reference extensions. There is no canonical general `description` field. |
| `lib/schemas/content-types/subrace.ts`, `trait.ts` | Subrace stores parent race **slug**, description, trait/language slugs. Trait stores race/subrace slugs, description, optional usages/recovery. These schemas do not contain dependency IDs/versions. |
| `lib/character/structured-sources.ts`, `lib/engine/evaluator.ts:189` | Live sources select the first race. The evaluator prepends ability effects from its structured scores; structured speed prefers `speed_detail` over flat speed. Traits/subraces are not included as structured race sources. |
| `scripts/transformers/races.ts`, `supabase/migrations/00011_race_enrichment.sql` | The SRD transformer emits additive ability effects, movement-speed set and string size set. Enrichment merges structured scores/speed fields into data without replacing effects. This exact provenance can yield both representations of the same bonus. It does **not** establish that arbitrary user effects are duplicates or confirm current hosted rows. |
| `lib/engine/evaluator.ts:336` | Static effects coerce string values to numeric zero. Copying the transformer's size set is not a sound size calculation contract. |
| Race builder, `components/builder/stat-preview.tsx`, Class builder | Race StatPreview and Class resolved-stat/prerequisite paths call evaluate without structured sources. Abilities builder prefers six structured race/subrace scores and skips their additive effects. SQL prerequisite helper in `20260721221108_feat_selection_and_campaign_revocation.sql` deliberately uses a similar no-double-counting branch. Their current contracts differ from the live evaluator. |
| Race builder and `lib/supabase/content-refs.ts` | Race/subrace selections pin ID/version. Saved pins are read from immutable snapshots and conflicting/mismatched pins block controls. Trait arrays are slug-only; unpinned traits resolve current catalog content with an explicit disclosure. Selection is a sequence of separate character/ref mutations, not an atomic graph commit. |
| `lib/import/mpmb/types.ts`, `lib/import/mpmb/map/index.ts` | Installed static importer registries/mappers support sources, spells and feats only. There is no implemented MPMB race/subrace/trait mapper to reuse or claim as race acceptance. Enrichment's MPMB provenance is a separate historical path. |

The race-score/size findings belong to **R06 calculation parity**, not a guessed data cleanup in this child. Before proposing a fix, reproduce using an actual parsed immutable-pin fixture through canonical snapshot parsing, the live source collector/evaluator, Race preview, Abilities bonuses, Class prerequisites, and the SQL helper where a local runtime is authorized. Capture exact raw/snapshot fields and source provenance; label synthetic fixtures and hosted evidence separately. Never infer duplicate intent from matching numbers in arbitrary user-owned effects.

## Finite first-child form

| Control | Persistence and limits |
| --- | --- |
| Name | Trimmed, required, 1–100 characters; immutable slug/identity stays server-derived. |
| Size | Exact `CREATURE_SIZES` enum. Display metadata; no invented size mechanics. |
| Walking speed | Required positive safe integer feet; blank/zero/negative/fractional/NaN/hex/overflow rejected. No invented default. Synchronize only flat speed and the walking entry. |
| Age/alignment/size/language descriptions | Existing canonical fields, optional bounded original prose (20,000 characters each), with explicit descriptions-versus-grants distinction. No copied book text. |

Creation initializes empty canonical trait/subrace/language/vision/resistance/proficiency/source-reference arrays. Scores and optional advanced fields remain absent. Editing overlays only authored keys on original raw JSON; preserves unknown top-level/nested fields, non-walking `speed_detail` entries, relationship arrays, scores, grants/choices/narratives and unrelated effects. Raw extras and server authoring metadata remain internal; forged browser effects/owner/system/scope/source/version/relations/marker payloads are ignored.

## Authored-effect ownership and safe edits

Use one reserved mechanical tag (for example `inkborne:race-core:v1:walking-speed`) and server-owned raw authoring manifest containing the exact owned effect payload plus its contract version. Canonical effect/data schemas validate known fields; persistence must retain original raw JSON rather than serialize stripped parser output. No new database/schema migration is needed for this internal JSON extension.

- **Create:** derive the private envelope, consistent speed fields and one validated owned effect from finite controls. Browser-supplied manifests/tags/effects never participate.
- **Marked mechanical edit:** authenticate and read the exact owned active expected-version row. Require the recorded owned effect to match exactly one raw effect, the walking values to match that manifest, and no unowned/conflicting movement-speed effect. Replace only that exact owned entry, at its existing position, and synchronize walking fields. Preserve every other raw effect unchanged. Duplicate/missing/altered owned entries or competing manual movement effects make walking read-only or return a constrained error before writing; never guess which effect to remove.
- **Legacy/unmarked or ambiguous record:** permit metadata-only editing. Walking speed is read-only and effects are omitted from UPDATE. Preserve existing untagged movement effects, scores, size effects and all raw extensions; do not append a competing effect, migrate/normalize old values, or infer ownership from an equal number. The server enforces this even if the browser forges speed controls.
- **CAS:** use the reviewed owner/system/type/homebrew/personal/active and expected-version filters, single write, constrained `id, version` conflict reread, no stale retry. Authentication precedes reads/writes; resolve exactly one published canonical system. Preserve native-reset drafts, visible named errors and explicit latest-version reload. Stable ID/slug and immutable historical character pins remain unchanged.

A first-child warning must disclose that imported ability/trait/subrace mechanics are retained but their current calculation/pinning gaps are not repaired here. Unrelated/manual effects must remain intact; an unsupported speed edit fails rather than deleting or reclassifying them.

## Exact-reference and entitlement contract for remaining children

The first child creates **no dependency links** and exposes existing trait/subrace relationships as read-only, with the existing unpinned-trait limitation preserved. It must not advertise exact dependency versioning that the current slug arrays do not provide.

Before enabling dependency editing, define an immutable race/subrace relationship manifest of exact `(content_id, version, slug, type, system_id)` tuples, persisted alongside the parent version. Resolve references server-side with the authenticated owner in the published canonical system; require correct type, unique identity/slug, active current definition, valid exact snapshot, and parent-race/subrace consistency. A referenced private child must belong to that owner; platform content must actually be readable under the current access rules. Shared/campaign dependencies remain a later extension, not inferred from a slug.

Revalidate offered dependency IDs/versions when saving; reject stale offered versions, missing/retired rows, wrong system/type/owner/parent, ambiguous slug matches and lost access. At character selection, the character owner/system/entitlements must be checked again, and the parent plus linked traits/subrace must be pinned from those exact manifested versions; no latest-catalog fallback for manifested links. Existing pins stay historical after content edits or sharing revocation under established access rules. Current `private.can_use_content_version` enforces character-owner/system and platform/owner/campaign-share access, but it is not a race dependency/parent-type validator. No separate book-license entitlement model was found in the inspected access path; readable metadata is not permission to copy paid book content.

Atomic selection/replacement of the race dependency graph is a separate required contract. The existing sequential builder mutations cannot prove all-or-nothing trait/subrace activation. Choose its transaction boundary and local database acceptance before implementation; no SQL/provider change is authorized by this planning checkpoint.

## Acceptance and sequence

1. **Core authoring child:** mapper/canonical-parser tests; authentic derived private envelope; hidden-authority rejection; raw/manual-effect preservation; legacy speed read-only; marked-effect collision/mismatch tests; one-write stale conflict; foreign/system/type/retired denial; form error/pending/draft/reload browser proof. For an isolated new race with no other movement effects, compare parsed exact-pin `speed.walk` and `computed.movement_speed` plus Race preview to the authored speed. Confirm metadata size display without a numeric size effect. Then edit v2 and prove the existing v1 character snapshot stays v1. Feature/manual/buff stacking parity is a separate existing consumer contract, not implied by this narrow base-speed proof.
2. **R06 parity prerequisite:** parsed-pin reproduction and independently approved score/size/source policy across live evaluation, previews, Abilities/Class/SQL prerequisites. Only then expose six ability controls or promise corresponding score calculations. Do not fix arbitrary existing effects by assumption.
3. **Relations child:** original trait/subrace authoring plus exact manifests, current owner/system/type/entitlement and stale-version validation, atomic graph selection, dependency removal/replacement and immutable pins. Historical slug-only rows need an explicit reviewed compatibility/adoption policy; do not infer old trait versions.
4. **Advanced mechanics child:** supported movement types, vision/resistances/save notes, proficiencies/languages/choices/resources, each only after actual consumers and vocabulary are validated. Subrace structured mechanics are not automatically supported by the present source collector/parser. MPMB race import and sharing remain separate contracts.

Implementation after independent plan challenge should stay in new race mapper/form/DAL/actions/routes/tests plus minimal Homebrew discovery. Consumer parity fixes, relation transactions, source/evaluator changes, and schema/provider/SQL work require their own approved child scope. Root owns resource-slot release, independent source review, combined checks/build and later database acceptance. Plan-only status is **not R12.4 feature completion**.
