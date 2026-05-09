# Domain Layer

The domain layer is the rules engine that turns a `Character`'s base stats and content selections into a fully resolved character sheet. A `Character` row stores `base_stats`, `choices`, and `state`; selected SRD/homebrew content lives in `content_definitions` (canonical) and is linked per-character via `character_content_refs`. Each content definition carries an `effects` array (a tagged union of `mechanical | narrative | grant | choice`). The engine in `lib/engine/` folds those effects over the base stats — first by op priority, then by formula evaluation against schema-driven derived stats — to produce an `EvaluationResult`. A `SystemSchemaDefinition` (stored on `game_systems.schema_definition` JSONB) plugs in the game system: ability scores, derived-stat formulas, skills, content types, sheet sections. D&D 5e 2014 is the launch system; D&D 5e 2024 is registered as draft.

## 1. Type Model

### Character ([lib/types/character.ts](lib/types/character.ts))

```ts
interface Character {
  id: string; user_id: string; system_id: string;
  campaign_id: string | null; name: string;
  visibility: "private" | "campaign" | "public";
  archived: boolean; level: number;
  base_stats: Record<string, number>;   // raw STR/DEX/... before effects
  choices: CharacterChoices;            // build-time picks
  state: CharacterState;                // runtime state (HP, conditions, ...)
  narrative: NarrativeData;
  narrative_rich: NarrativeRichData;
}
```

`CharacterWithSystem` extends `Character` with a joined `game_systems` row including the `SystemSchemaDefinition`.

### CharacterChoices ([lib/types/character.ts:43](lib/types/character.ts:43))

```ts
interface CharacterChoices {
  classes?: Array<{ slug: string; level: number; subclass?: string }>;
  race?: string; subrace?: string; background?: string;
  ability_method?: "standard_array" | "point_buy" | "manual";
  ability_assignments?: Record<string, number>;
  resolved_choices?: Record<string, string[]>;        // keyed by ChoiceEffect.choice_id
  asi_choices?: Record<string, AsiChoice>;            // keyed by feature slug
  hp_rolls?: Record<string, HpRollRecord>;            // "{classSlug}-{level}"
  // + alignment, personality_traits, ideals, bonds, flaws, starting_equipment
}
```

### CharacterState ([lib/types/character.ts:70](lib/types/character.ts:70))

```ts
interface CharacterState {
  current_hp?: number; temp_hp?: number;
  conditions?: string[]; death_saves?: { successes; failures };
  inspiration?: boolean; quick_notes?: string; notes?: string;
  spell_slots_used?: SpellSlotsUsed;
  concentrating_on?: ConcentrationState | null;
  exhaustion?: number;                     // 0-6, RAW
  feature_uses?: Record<string, number>;   // FeatureResource.slug -> spent
  equipped_armor?: "none" | "light" | "medium" | "heavy";
  shield_equipped?: boolean; rage_active?: boolean;
  currency?: Currency;
  [key: string]: unknown;
}
```

### Effect union ([lib/types/effects.ts:54](lib/types/effects.ts:54))

```ts
type Effect = MechanicalEffect | NarrativeEffect | GrantEffect | ChoiceEffect;
```

| Variant | Shape | Used for |
|---|---|---|
| `MechanicalEffect` | `{ type, stat, op, value?, expr?, condition?, tag? }` | Numeric stat changes; `op` is `add\|set\|multiply\|max\|min\|grant\|formula` |
| `NarrativeEffect` | `{ type, text, tag? }` | Display-only text on sheet |
| `GrantEffect` | `{ type, stat, value }` | Skill/save proficiencies, expertise, named features |
| `ChoiceEffect` | `{ type, choose, from, grant_type, choice_id }` | Resolved into `choices.resolved_choices[choice_id]` |

Conditions: `StatCondition` (`{ stat, op: gte\|lte\|gt\|lt\|eq\|neq, value }`) gates progression triggers and prereqs. `StateCondition` (`{ field, op: eq\|neq, value }`) gates `MechanicalEffect.condition` against `CharacterState` (e.g. `equipped_armor === "none"`).

### SystemSchemaDefinition ([lib/types/system.ts:67](lib/types/system.ts:67))

```ts
interface SystemSchemaDefinition {
  ability_scores: AbilityScoreDefinition[];      // {slug, name, abbr}
  proficiency_levels: ProficiencyLevel[];        // {slug, name, multiplier}
  derived_stats: DerivedStatDefinition[];        // {slug, name, formula?, base?}
  skills: SkillDefinition[];                     // {slug, name, ability}
  resources: ResourceDefinition[];               // hit_points, hit_dice, spell_slots, ...
  content_types: ContentTypeDefinition[];        // race, class, subclass, ...
  currencies: CurrencyDefinition[];
  creation_steps: CreationStep[];
  sheet_sections: SheetSection[];
}
```

Validated by `systemSchemaDefinitionSchema` in [lib/schemas/system.ts:69](lib/schemas/system.ts:69). The `GameSystem` row also carries `expression_context: Record<string, unknown>` for per-system constants.

### Other type modules

- [lib/types/inventory.ts](lib/types/inventory.ts) — `InventoryItem`, `Currency` (`cp/sp/ep/gp/pp`).
- [lib/types/spells.ts](lib/types/spells.ts) — `CharacterSpell`, `SpellSlotsUsed`, `ConcentrationState`, `CasterClass` (`type: full|half|pact|third`), `CasterInfo`.
- [lib/types/resources.ts](lib/types/resources.ts) — `FeatureResource` (Rage/Ki counters; `recovery: short|long`).
- [lib/types/narrative.ts](lib/types/narrative.ts) — `NarrativeData`, `NarrativeRichData` (Tiptap `JSONContent`), `Npc`.
- [lib/types/taxonomies.ts](lib/types/taxonomies.ts) — frozen const arrays for `DAMAGE_TYPES`, `MAGIC_SCHOOLS`, `WEAPON_PROPERTIES`, `VISION_TYPES`, `RECOVERY_TYPES`, etc.
- [lib/types/content.ts](lib/types/content.ts) — `ContentDefinition`, `ContentVersion`, `CustomContentType`, `ContentShare`.

## 2. Content Data Model

### content_definitions ([supabase/migrations/00003_content.sql:1](supabase/migrations/00003_content.sql:1))

```sql
content_definitions(
  id, system_id (-> game_systems),
  content_type text, slug text, name text,
  data jsonb default '{}',         -- type-specific payload (validated per content_type)
  effects jsonb default '[]',      -- Effect[]
  source text  in ('srd','homebrew'),
  scope  text  in ('platform','personal','shared'),
  owner_id uuid (-> profiles, nullable),
  version int default 1,
  unique(system_id, content_type, slug, owner_id)
)
```

`content_versions` snapshots `data`/`effects` per published version.

### character_content_refs ([supabase/migrations/00007_character_builder.sql:13](supabase/migrations/00007_character_builder.sql:13))

```sql
character_content_refs(
  id, character_id (-> characters),
  content_id (-> content_definitions),
  content_version int default 1,
  context jsonb default '{}',     -- e.g. {classIndex, levelTaken}
  choice_source text              -- choice_id that produced this ref (for cleanup)
)
```

### content_type registry

The 5e 2014 schema declares these content types ([supabase/seed.sql:60](supabase/seed.sql:60)):

| slug | required | max | parent |
|---|---|---|---|
| `race` | yes | 1 | — |
| `class` | yes | unlimited | — |
| `subclass` | — | — | `class` |
| `background` | yes | 1 | — |
| `feat` | — | unlimited | — |
| `spell` | — | — | — |
| `item` / `weapon` / `armor` | — | — | — |

Additional internal types not in `content_types` array but used in `content_definitions.content_type`: `feature`, `subrace`, `trait`, `language`, `proficiency`, `magic_item`. Per-type `data` shapes are validated by Zod schemas in [lib/schemas/content-types/](lib/schemas/content-types) — `index.ts` registers them in `CONTENT_TYPE_SCHEMAS` and `getContentTypeSchema(contentType)` looks them up.

### Feature types ([lib/schemas/content-types/feature.ts:50](lib/schemas/content-types/feature.ts:50))

```ts
FEATURE_TYPES = ["passive","asi","subclass","fighting_style","choice"]
```

Set on `data.feature_type`. Drives builder rail behavior — see `class-features-per-level.ts`.

### Effects array example

Each `content_definition.effects` is a flat `Effect[]`:

```json
[
  { "type": "mechanical", "stat": "armor_class", "op": "formula",
    "expr": "10 + mod(dexterity) + mod(constitution)", "tag": "ac_formula",
    "condition": [{ "field": "equipped_armor", "op": "eq", "value": "none" }] },
  { "type": "grant", "stat": "athletics", "value": "proficient" },
  { "type": "narrative", "text": "Reckless attack: advantage on STR attacks." },
  { "type": "choice", "choose": 2, "from": ["acrobatics","stealth","..."],
    "grant_type": "skill_proficiency", "choice_id": "rogue-skills-1" }
]
```

Custom homebrew types live in `custom_content_types` ([lib/types/content.ts:31](lib/types/content.ts:31)).

## 3. Engine ([lib/engine/](lib/engine))

### Entry point: `evaluate()` ([lib/engine/evaluator.ts:180](lib/engine/evaluator.ts:180))

```ts
function evaluate(
  baseStats: Record<string, number>,
  effects: Effect[],
  schema: SystemSchemaDefinition,
  sources?: StructuredSources,
  state?: Record<string, unknown>,
): EvaluationResult
```

Returns `{ stats, computed, narratives, grants, speed, vision, dmgres, savetxt, attacks, improvements }` ([lib/engine/evaluator.ts:44](lib/engine/evaluator.ts:44)).

The pipeline (numbered comments in source):

1. Prepend race ASI bonuses via `raceScoreEffects` ([lib/engine/evaluator.ts:150](lib/engine/evaluator.ts:150)) — converts the 6-element `scores` array into `add` mechanical effects.
2. Bucket by effect type. Mechanical effects gated by `checkCondition` ([lib/engine/conditions.ts:9](lib/engine/conditions.ts:9)) — array conditions are AND.
3. Split mechanical into static (`add/set/multiply/max/min`) vs `formula` (Tier 2).
4. Sort static by `EFFECT_OP_PRIORITY` ([lib/types/effects.ts:83](lib/types/effects.ts:83)) — `set < add < min < max < multiply < grant < formula`. Implemented in `sortEffectsByPriority` ([lib/engine/effects.ts:8](lib/engine/effects.ts:8)).
5. Partition static effects: targets in `schema.derived_stats[].slug` go to `derivedStatEffects`, others to `baseStatEffects`.
6. `applyStaticEffects` ([lib/engine/evaluator.ts:336](lib/engine/evaluator.ts:336)) folds the sorted list into `stats` in-place.
7. Compute each derived stat in schema order via `parseExpression` ([lib/engine/parser.ts:262](lib/engine/parser.ts:262)). Builtins exposed: `mod(score)`, `proficiency_if(skill)`, plus math `floor/ceil/max/min`. Later derived stats can reference earlier ones (the context is `{ ...stats, ...computed }` rebuilt each iteration).
8. Apply non-AC static derived effects, then handle AC best-of: every effect with `tag: "ac_formula"` is evaluated against current context and the max wins (e.g. Barbarian Unarmored Defense vs equipped armor). Then deferred AC adds (shield bonus etc.) layer on top.
9. Apply remaining formula effects.
10. Aggregate `StructuredSources` via `collectStructuredData` ([lib/engine/evaluator.ts:64](lib/engine/evaluator.ts:64)) — race + features merge `speed`, `vision` (max range per type), `dmgres` (union), `savetxt.adv_vs/immune` (union); class lookup tables provide `attacks[level-1]` and `improvements[level-1]`.

There is no top-level `applyEffect` / `resolveChoice` — choices are resolved at build time (writing into `choices.resolved_choices`) and then re-emitted as static `grant` effects from helper code. The "fold over effects" pattern lives entirely inside `evaluate()` via `applyStaticEffects` + the formula passes.

### parser ([lib/engine/parser.ts](lib/engine/parser.ts))

Hand-rolled recursive-descent expression evaluator: number literals, identifiers (stat refs, fall back to `0`), function calls, math operators with standard precedence, single/double-quoted strings as fn args. Public API is `parseExpression(expr, stats, builtins)`.

### sandbox ([lib/engine/sandbox.ts](lib/engine/sandbox.ts))

Stub for Tier 3 script effects. Currently returns `{ modifications: {} }` — full implementation deferred.

## 4. Builder Helpers ([lib/builder/](lib/builder))

| File | Kind | Role |
|---|---|---|
| [class-features-per-level.ts](lib/builder/class-features-per-level.ts) | pure | Walks `class.data.levels` + subclass levels, partitions each level into displayed `features[]` and interactive `choices[]` (`asi`, `subclass`, `fighting-style`, `generic`). Exports `PerLevel`, `PerLevelChoice`, `classFeaturesPerLevel(args)`. |
| [class-tone.ts](lib/builder/class-tone.ts) | pure | UI-only: maps caster classes to `purple`, martials to `gold`. `classTone(slug)`, `classEmblemLetter(slug, name?)`. |
| [level-up-rules.ts](lib/builder/level-up-rules.ts) | pure | `HpRule` enum re-export, `resolveHpRule(campaign, system)`, and `hpContributionForLevel({ die, isFirstLevelOfPrimary, isFirstLevelOfClass, storedRoll, rule })` — encodes RAW + the five `HpRule` modes. |
| [multiclass-prereqs.ts](lib/builder/multiclass-prereqs.ts) | pure | `MULTICLASS_PREREQ_TABLE` (per-class `all`/`any` ability mins), `evaluateMulticlassPrereq(slug, stats, selected)`, `multiclassPrereqsForAll(...)`. Returns `met \| not-met \| already-in-build`. |
| [use-is-mobile.ts](lib/builder/use-is-mobile.ts) | React hook | SSR-safe `useIsMobile()` — returns `false` until hydration, then tracks `(max-width: 767px)`. |

## 5. Character Helpers ([lib/character/](lib/character))

| File | Kind | Role |
|---|---|---|
| [max-hp.ts](lib/character/max-hp.ts) | pure | `computeMaxHp(classes, classContent, conScore, hpRolls?, hpRule?)`. Walks class levels, applies `hpContributionForLevel` per level + `max(1, contribution + conMod)` floor. Lives outside the engine because `hit_die_total` is per-class iteration that the scalar expression parser can't express. |
| [character-context.tsx](lib/character/character-context.tsx) | React context | Client-side `CharacterProvider`/`useCharacter()`. Calls `evaluate()` with the joined refs, owns mutations for state, inventory, spells, rest. Glue between domain helpers and React. |

## 6. Schema & System Plug-in Model

A game system is a row in `game_systems` ([supabase/migrations/00002_game_systems.sql](supabase/migrations/00002_game_systems.sql)) carrying `schema_definition` (validated by [lib/schemas/system.ts](lib/schemas/system.ts)) and `expression_context`. Both 5e systems are seeded in [supabase/seed.sql](supabase/seed.sql):

- `dnd-5e-2014` — `published`, primary launch system.
- `dnd-5e-2024` — `draft`, awaiting content load.

### Where derived-stat math lives

The schema's `derived_stats[].formula` is the single source of truth for AC, initiative, prof bonus, passive perception, spell DC, etc. `evaluate()` runs them through `parseExpression`. Formulas can reference any base stat slug, prior derived stat slug, the magic `level`, and the builtins (`mod`, `proficiency_if`, `floor`, `ceil`, `max`, `min`).

Per-system overrides go into JSONB at `game_systems.schema_definition`. Per-campaign HP-rule override is stored on `campaigns.hp_rule` ([supabase/migrations/00036_campaigns_hp_rule.sql](supabase/migrations/00036_campaigns_hp_rule.sql)) and resolved by `resolveHpRule(campaign, system)`.

### Extending to a new system

1. Insert a `game_systems` row with a fresh `slug` and a populated `schema_definition` JSONB matching `systemSchemaDefinitionSchema`.
2. Define content via `content_definitions` rows with that `system_id`.
3. (Optional) Register additional Zod schemas via `registerContentTypeSchema(contentType, schema)` in [lib/schemas/content-types/index.ts:40](lib/schemas/content-types/index.ts:40) for typed payload validation.
4. Effects reuse the same `Effect` union. New `op` values would require parser/evaluator updates in [lib/engine/evaluator.ts](lib/engine/evaluator.ts).

The engine itself is system-agnostic — it only consumes `SystemSchemaDefinition` + `Effect[]`.

## 7. Migrations ([supabase/migrations/](supabase/migrations))

Foundation:

- `00001_profiles.sql` — `profiles` table.
- `00002_game_systems.sql` — `game_systems` (`schema_definition` JSONB).
- `00003_content.sql` — `content_definitions` + `content_versions`.
- `00004_campaigns.sql` — `campaigns`, `campaign_members`, `characters` skeleton.
- `00005_homebrew_sharing.sql` — `content_shares`, `content_type_shares`.
- `00006_rls_policies.sql` — RLS for foundation tables.

Builder:

- `00007_character_builder.sql` — adds `level/base_stats/choices/state` to `characters`; creates `character_content_refs`.
- `00008_profile_preferences.sql` — `profiles.preferences` JSONB.
- `00009_narrative_tools.sql` — `npcs` + narrative columns.

Content enrichment (SRD ingestion + builder UX):

- `00010_feature_types.sql` — backfills `data.feature_type` (`asi`, `subclass`, `fighting_style`, `passive`).
- `00011_race_enrichment.sql` — race scores/speed/vision/dmgres/savetxt structure.
- `00012_feature_enrichment.sql` — feature mechanical fields.
- `00013_class_enrichment.sql` — class hit_die/levels/multiclass.
- `00014_spellcasting_enrichment.sql`, `00015_cantrip_scaling.sql`.
- `00016_feat_enrichment.sql`, `00017_background_enrichment.sql`.
- `00018_class_detail_enrichment.sql`, `00019_monk_choice_fix.sql`, `00020_class_descriptions.sql`.
- `00021_fighting_style_effects.sql`, `00022_feature_effects.sql`.
- `00023_remove_details_step.sql` — drops the standalone Details step from `creation_steps`.
- `00024_storage_policies.sql` — Supabase storage RLS for portraits.

Inventory & spells:

- `00025_character_inventory.sql` — `character_inventory` table.
- `00026_magic_item_enrichment.sql`.
- `00029_character_spells.sql`, `00030_spellcasting_fixes.sql`, `00031_patch_character_state_rpc.sql`.

Ops & telemetry:

- `00032_feedback_table.sql`, `00033_app_errors_table.sql`.

Resource enrichment:

- `00034_feature_resource_data_enrichment.sql`, `00035_feature_resource_data_enrichment_2.sql`.

HP rule (most recent):

- `00036_campaigns_hp_rule.sql` — adds `campaigns.hp_rule` with CHECK constraint matching `HpRule` enum.

(Numbers `00027` and `00028` are skipped in this branch.)
