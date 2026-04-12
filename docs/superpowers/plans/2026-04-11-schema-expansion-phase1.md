# Schema Expansion Phase 1: Character Sheet Accuracy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand race, feature, and class schemas with mechanical fields (ability scores, speed types, vision, resistances, action economy, usage tracking) so the character sheet displays accurate, automated values.

**Architecture:** Extend Zod schemas with new optional fields (backward-compatible). SQL migration seeds existing SRD content with MPMB-sourced mechanical data. Update the expression engine evaluator to collect and apply the new structured fields. Update race/class/feature transformers for future imports.

**Tech Stack:** TypeScript, Zod, Supabase (Postgres), expression engine (`lib/engine/evaluator.ts`)

**Spec:** `docs/superpowers/specs/2026-04-11-mpmb-schema-audit.md` (Phase 1 section)

---

## Critical Rules

- All new schema fields MUST be optional with sensible defaults — existing data must not break on validation
- Use MPMB `ListsRaces.js` and `ListsClasses.js` from GitHub as the source of truth for enrichment values
- SQL migrations must be idempotent — use `jsonb_set` / merge patterns that don't clobber existing data
- Evaluator changes must gracefully degrade when new fields are absent (check existence before aggregating)
- Focus on SRD content only — do not enrich non-SRD content
- Semantic Tailwind colors only in any UI changes

---

## Shared Type Definitions (Prerequisite)

Before expanding individual schemas, define shared sub-schemas used across race, feature, and class schemas. These live in a new file so all content types can import them.

### Step 0: Create shared mechanical sub-schemas

- [ ] **0.1** Create `lib/schemas/content-types/mechanical.ts` with the following shared Zod schemas:

```typescript
// Speed object — used by race and feature schemas
export const speedSchema = z.object({
  walk: z.number().int().nonnegative().optional(),
  fly: z.number().int().nonnegative().optional(),
  swim: z.number().int().nonnegative().optional(),
  climb: z.number().int().nonnegative().optional(),
  burrow: z.number().int().nonnegative().optional(),
  encumbered: z.number().int().nonnegative().optional(),
});

// Vision entry — darkvision 60, blindsight 10, etc.
export const VISION_TYPES = ["darkvision", "blindsight", "truesight", "tremorsense"] as const;
export const visionEntrySchema = z.object({
  type: z.enum(VISION_TYPES),
  range: z.number().int().positive(),
});

// Save text — advantage vs X, immune to Y
export const savetxtSchema = z.object({
  adv_vs: z.array(z.string()).default([]),
  immune: z.array(z.string()).default([]),
});

// Ability score array — [STR, DEX, CON, INT, WIS, CHA]
export const abilityScoreArraySchema = z.array(z.number().int()).length(6);

// Action economy enum
export const ACTION_TYPES = ["action", "bonus action", "reaction", "free"] as const;

// Recovery enum
export const RECOVERY_TYPES = ["short rest", "long rest", "dawn", "day"] as const;

// Proficiency grants (by category)
export const proficiencyGrantsSchema = z.object({
  weapons: z.array(z.string()).default([]),
  armor: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
});
```

- [ ] **0.2** Export `SpeedData`, `VisionEntry`, `SavetxtData`, `ProficiencyGrants` TypeScript types via `z.infer<>`
- [ ] **0.3** Add `VISION_TYPES` and `RECOVERY_TYPES` to `lib/types/taxonomies.ts` as const arrays (alongside existing `DAMAGE_TYPES`, etc.)

**Verify:** `npx tsc --noEmit` passes. No runtime usage yet — these are just type definitions.

---

## Step 1: Expand Race Zod Schema

**File:** `lib/schemas/content-types/race.ts`

- [ ] **1.1** Import shared sub-schemas from `mechanical.ts`
- [ ] **1.2** Add the following optional fields to `raceDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `scores` | `abilityScoreArraySchema.optional()` | `undefined` | `[STR,DEX,CON,INT,WIS,CHA]` bonus array |
| `scorestxt` | `z.string().optional()` | `undefined` | Human-readable score description |
| `speed_detail` | `speedSchema.optional()` | `undefined` | Full speed object; existing `speed: number` kept for backward compat |
| `vision` | `z.array(visionEntrySchema).default([])` | `[]` | Vision grants |
| `dmgres` | `z.array(z.string()).default([])` | `[]` | Damage resistance strings (from `DAMAGE_TYPES`) |
| `savetxt` | `savetxtSchema.optional()` | `undefined` | Save advantages/immunities |
| `skills` | `z.array(z.string()).default([])` | `[]` | Skill proficiency grants |
| `skillstxt` | `z.string().optional()` | `undefined` | Skill choice description |
| `weaponProfs` | `z.array(z.string()).default([])` | `[]` | Weapon proficiency grants |
| `armorProfs` | `z.array(z.string()).default([])` | `[]` | Armor proficiency grants |
| `toolProfs` | `z.array(z.string()).default([])` | `[]` | Tool proficiency grants |

- [ ] **1.3** Keep existing `speed: z.number().int().positive()` field unchanged (backward-compatible; `speed_detail` is the new structured version)

**Verify:** `npx tsc --noEmit` passes. Parse existing race data through the schema to confirm backward compatibility.

---

## Step 2: Expand Feature Zod Schema

**File:** `lib/schemas/content-types/feature.ts`

- [ ] **2.1** Import shared sub-schemas from `mechanical.ts`
- [ ] **2.2** Add the following optional fields to `featureDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `action` | `z.enum(ACTION_TYPES).nullable().default(null)` | `null` | Action economy cost |
| `usages` | `z.union([z.number(), z.array(z.number().nullable()).length(20)]).optional()` | `undefined` | Flat number or per-level array |
| `recovery` | `z.enum(RECOVERY_TYPES).nullable().default(null)` | `null` | Resource recovery timing |
| `additional` | `z.array(z.string().nullable()).length(20).optional()` | `undefined` | Per-level scaling text (e.g., rage damage) |
| `scores` | `abilityScoreArraySchema.optional()` | `undefined` | Ability score modifications |
| `scoresMaximum` | `abilityScoreArraySchema.optional()` | `undefined` | Ability score caps |
| `vision` | `z.array(visionEntrySchema).default([])` | `[]` | Vision grants |
| `speed` | `speedSchema.optional()` | `undefined` | Speed modifications |
| `dmgres` | `z.array(z.string()).default([])` | `[]` | Damage resistances |
| `savetxt` | `savetxtSchema.optional()` | `undefined` | Save advantages/immunities |
| `extraAC` | `z.number().optional()` | `undefined` | Flat AC bonus (simple case) |
| `extraLimitedFeatures` | `z.array(z.object({ name: z.string(), usages: z.number(), recovery: z.enum(RECOVERY_TYPES) })).default([])` | `[]` | Additional limited-use resources granted |

**Verify:** `npx tsc --noEmit` passes. Parse existing feature data through the schema to confirm backward compatibility.

---

## Step 3: Expand Class Zod Schema

**File:** `lib/schemas/content-types/class.ts`

- [ ] **3.1** Add the following optional fields to `classDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `attacks` | `z.array(z.number().int().positive()).length(20).optional()` | `undefined` | Attacks per action per level (e.g., Fighter gets 2 at level 5) |
| `improvements` | `z.array(z.boolean()).length(20).optional()` | `undefined` | Which levels get ASI (`true` at levels 4, 8, 12, 16, 19 for most) |

**Verify:** `npx tsc --noEmit` passes. Parse existing class data through the schema to confirm backward compatibility.

---

## Step 4: SQL Migration — Race Data Enrichment

**File:** `supabase/migrations/00011_mpmb_race_enrichment.sql`

Fetch MPMB race data from `ListsRaces.js` (GitHub: `morepurplemorebetter/MPMBs-Character-Record-Sheet`) to get exact values. Populate by merging into the existing JSONB `data` column.

- [ ] **4.1** Fetch MPMB `ListsRaces.js` from GitHub to extract exact ability score arrays, speed objects, vision, damage resistances, save text, skills, and proficiency arrays for each SRD race
- [ ] **4.2** Write idempotent SQL statements for each SRD race. Pattern:

```sql
-- Example: Dwarf
UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'scores', '[0,0,2,0,0,0]'::jsonb,
    'speed_detail', '{"walk":25,"encumbered":25}'::jsonb,
    'vision', '[{"type":"darkvision","range":60}]'::jsonb,
    'dmgres', '["poison"]'::jsonb,
    'savetxt', '{"adv_vs":["poison"],"immune":[]}'::jsonb,
    'toolProfs', '[]'::jsonb,
    'weaponProfs', '["battleaxe","handaxe","light hammer","warhammer"]'::jsonb,
    'armorProfs', '[]'::jsonb,
    'skills', '[]'::jsonb
  )
WHERE content_type = 'race'
  AND slug = 'dwarf'
  AND source = 'srd'
  AND scope = 'platform';
```

- [ ] **4.3** Cover all SRD races: Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling
- [ ] **4.4** Cover SRD subraces: Hill Dwarf, High Elf, Lightfoot Halfling, Rock Gnome (and any others in the SRD). Update the `subrace` content_type rows with scores, vision, etc. where subraces provide additional mechanical data
- [ ] **4.5** Wrap the entire migration in a transaction for atomicity

**Verify:** Run the migration against the development database. Query `SELECT slug, data->'scores', data->'speed_detail', data->'vision', data->'dmgres' FROM content_definitions WHERE content_type = 'race' AND source = 'srd';` to confirm values populated.

---

## Step 5: SQL Migration — Feature Data Enrichment

**File:** `supabase/migrations/00012_mpmb_feature_enrichment.sql`

Focus on the most impactful SRD features first. These are the features that have action economy, usages, recovery, and per-level scaling.

- [ ] **5.1** Fetch MPMB `ListsClasses.js` from GitHub to extract feature mechanical data
- [ ] **5.2** Enrich high-impact Barbarian features:
  - **Rage**: `action: "bonus action"`, `usages: [null,null,2,2,3,3,3,3,4,4,4,4,5,5,5,5,5,5,6,999]`, `recovery: "long rest"`, `additional: [null,null,"+2","+2","+2","+2","+2","+2","+3","+3","+3","+3","+3","+3","+3","+3","+4","+4","+4","+4"]`, `dmgres: ["bludgeoning","piercing","slashing"]`
  - **Unarmored Defense (Barbarian)**: `extraAC` (narrative — AC = 10 + DEX + CON, handled by formula in evaluator)
  - **Reckless Attack**: `action: "free"` (made as part of first attack)
  - **Danger Sense**: `savetxt: { adv_vs: ["dexterity saves you can see"] }`
  - **Brutal Critical**: `additional` per-level dice array
- [ ] **5.3** Enrich high-impact Fighter features:
  - **Second Wind**: `action: "bonus action"`, `usages: 1`, `recovery: "short rest"`, `additional` per-level healing
  - **Action Surge**: `usages: [null,null,1,1,...,1,1,1,1,1,2,2,2,2,2]`, `recovery: "short rest"`
  - **Indomitable**: `usages` per-level, `recovery: "long rest"`
- [ ] **5.4** Enrich high-impact Rogue features:
  - **Sneak Attack**: `additional` per-level dice array `[null,"1d6","1d6","2d6","2d6","3d6",...]`
  - **Cunning Action**: `action: "bonus action"`
  - **Evasion**: `savetxt` (narrative effect — half damage on failed DEX save, no damage on success)
- [ ] **5.5** Enrich high-impact Monk features:
  - **Ki**: `usages` per-level `[null,null,2,3,4,5,...]`, `recovery: "short rest"`
  - **Unarmored Movement**: `speed: { walk: X }` per-level progression
  - **Unarmored Defense (Monk)**: AC formula (10 + DEX + WIS)
- [ ] **5.6** Enrich remaining high-impact features across other classes:
  - **Wild Shape** (Druid): `action: "action"`, `usages: 2`, `recovery: "short rest"`
  - **Channel Divinity** (Cleric/Paladin): `usages` per-level, `recovery: "short rest"`
  - **Bardic Inspiration**: `usages` (CHA mod, but can set minimum via per-level), `recovery` changes at level 5
  - **Sorcery Points** (Sorcerer): `usages` per-level, `recovery: "long rest"`
  - **Lay on Hands** (Paladin): `usages` (level * 5 pool), `recovery: "long rest"`
- [ ] **5.7** Enrich features that grant vision, speed, or resistances:
  - **Feral Senses** (Ranger): `vision: [{ type: "blindsight", range: 30 }]` (if applicable)
  - **Bear Totem Spirit**: `dmgres` (all except psychic)
  - Any feature granting darkvision improvements
- [ ] **5.8** Wrap in transaction. Use the same idempotent `data || jsonb_build_object(...)` pattern as race migration

**Verify:** Query updated features. Spot-check Rage, Sneak Attack, Ki, Action Surge for correct values.

---

## Step 6: SQL Migration — Class Data Enrichment

**File:** `supabase/migrations/00013_mpmb_class_enrichment.sql`

- [ ] **6.1** Add `attacks` array for all SRD classes. Most classes get `[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]`. Fighter gets `[1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]` (Extra Attack at 5, with 3 at 11 and 4 at 20). Monk and other martial classes get Extra Attack at 5
- [ ] **6.2** Add `improvements` boolean array for all SRD classes. Standard pattern: `[false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false]` (ASI at levels 4, 8, 12, 16, 19). Fighter gets extras at 6 and 14. Rogue gets an extra at 10
- [ ] **6.3** Wrap in transaction, use idempotent merge pattern

**Verify:** Query classes to confirm arrays. Check Fighter specifically has 6 ASI levels and correct attack progression.

---

## Step 7: Update Race Transformer

**File:** `scripts/transformers/races.ts`

- [ ] **7.1** Update `transformRaceEntry` to populate `speed_detail` from the API's `speed` value:

```typescript
speed_detail: { walk: apiRace.speed },
```

The API only provides walk speed, so other movement types stay undefined (they come from MPMB enrichment in the SQL migration).

- [ ] **7.2** Map `ability_bonuses` to the `scores` array format `[STR,DEX,CON,INT,WIS,CHA]`:

```typescript
const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];
const scores = [0, 0, 0, 0, 0, 0];
for (const bonus of apiRace.ability_bonuses) {
  const idx = ABILITY_ORDER.indexOf(bonus.ability_score.index);
  if (idx >= 0) scores[idx] = bonus.bonus;
}
```

Include `scores` in the data object.

- [ ] **7.3** Extract starting proficiencies into the typed `weaponProfs`, `armorProfs`, `toolProfs` arrays by matching against known proficiency types (the API provides a flat list; categorize by prefix or known sets)
- [ ] **7.4** Keep existing effect generation unchanged — the `scores` field in `data` is complementary to the `effects` array ability bonus entries

**Verify:** Run `npx tsx scripts/import-srd.ts` in dry-run mode (or a test) to confirm transformed race data includes the new fields and still passes schema validation.

---

## Step 8: Update Feature Transformer

**File:** `scripts/transformers/features.ts`

- [ ] **8.1** The dnd5eapi API does NOT provide action economy, usages, recovery, or additional fields. These come exclusively from MPMB data via the SQL migration (Step 5). The transformer cannot populate them from the API
- [ ] **8.2** Add a `// TODO: Phase 1 mechanical fields (action, usages, recovery, additional) are seeded from MPMB data via SQL migration 00012` comment in the transformer to document this
- [ ] **8.3** No functional changes to the transformer in this step — the enrichment is purely SQL-driven

**Verify:** Confirm existing transformer output still parses against the expanded schema (all new fields are optional).

---

## Step 9: Update Class Transformer

**File:** `scripts/transformers/classes.ts`

- [ ] **9.1** The API does not directly provide `attacks` or `improvements` arrays. However, the `class_specific` field on levels sometimes contains relevant data (e.g., `martial_arts` for Monk, `action_surges` for Fighter). For now, do NOT attempt to derive these from the API — the SQL migration (Step 6) handles it
- [ ] **9.2** Add a comment documenting that `attacks` and `improvements` are MPMB-seeded
- [ ] **9.3** Derive `improvements` from the existing level data where possible: if a level's `features` array includes `"ability-score-improvement"`, mark that level as `true` in the improvements array. This provides a partial mapping from API data:

```typescript
const improvements = sortedLevels.map((lvl) =>
  lvl.features.some((f) => f.index.includes("ability-score-improvement"))
);
```

Include in data output if the result contains any `true` values.

**Verify:** Run transformer, confirm class data includes `improvements` where derivable. `attacks` remains absent until SQL migration seeds it.

---

## Step 10: Update Evaluator

**File:** `lib/engine/evaluator.ts`

This is the most architecturally sensitive step. The evaluator currently works with flat `Effect[]` arrays. We need to also collect structured data from content refs (race, features) and aggregate them into the evaluation result.

- [ ] **10.1** Expand `EvaluationResult` to include new aggregate fields:

```typescript
export interface EvaluationResult {
  stats: Record<string, number>;
  computed: Record<string, number>;
  narratives: NarrativeEffect[];
  grants: GrantEffect[];
  // New Phase 1 aggregates
  speed: SpeedData;               // Merged speed from race + features
  vision: VisionEntry[];          // Collected from race + features
  dmgres: string[];               // Unique set of damage resistances
  savetxt: SavetxtData;           // Merged save advantages/immunities
  attacks: number;                // Attacks per action at current level
  improvements: boolean;          // Whether current level gets ASI
}
```

- [ ] **10.2** Create a new function `collectStructuredData` that accepts the character's content refs (race data, feature data, class data, level) and aggregates:
  - **Speed:** Start with race `speed_detail` (or `{ walk: race.speed }` fallback), merge feature speed bonuses additively
  - **Vision:** Concatenate race and feature vision arrays, deduplicate by type (keep highest range)
  - **Damage resistances:** Union of race and feature `dmgres` arrays, deduplicated
  - **Save text:** Merge `adv_vs` and `immune` arrays from race and features, deduplicated
  - **Attacks:** Look up `class.attacks[level - 1]`, default to 1
  - **Improvements:** Look up `class.improvements[level - 1]`, default to false

- [ ] **10.3** Update the main `evaluate()` function signature to accept an optional `structuredSources` parameter:

```typescript
export interface StructuredSources {
  raceData?: RaceData;
  featureData?: FeatureData[];
  classData?: ClassData;
  level?: number;
}

export function evaluate(
  baseStats: Record<string, number>,
  effects: Effect[],
  schema: SystemSchemaDefinition,
  sources?: StructuredSources,
): EvaluationResult { ... }
```

- [ ] **10.4** At the end of `evaluate()`, call `collectStructuredData(sources)` and spread the results into the returned `EvaluationResult`. If `sources` is undefined, return sensible defaults (empty arrays, `{ walk: 30 }` speed, etc.)
- [ ] **10.5** Wire race `scores` into ability score computation: if `sources.raceData?.scores` exists, generate `MechanicalEffect[]` from it (add to STR, DEX, CON, INT, WIS, CHA) and prepend to the effects list before evaluation. This ensures race ability bonuses flow through the standard pipeline

**Verify:** Write a unit test in `lib/engine/__tests__/evaluator.test.ts` (or add to existing) that:
1. Provides a mock race with `scores: [0,2,0,0,1,0]` (Elf-like), `speed_detail: { walk: 30 }`, `vision: [{ type: "darkvision", range: 60 }]`
2. Provides a mock feature with `dmgres: ["fire"]`, `speed: { fly: 30 }`
3. Confirms the merged result has correct speed `{ walk: 30, fly: 30 }`, vision includes darkvision 60, dmgres includes "fire", and DEX/WIS got the bonuses

---

## Step 11: Update Character Sheet Components

Update the character sheet to display the new structured data from the evaluation result.

- [ ] **11.1** Identify the character sheet display component (likely in `app/characters/[id]/sheet/` or `app/(app)/characters/[id]/page.tsx`) that renders stats
- [ ] **11.2** Add a **Speed** display section showing all movement types:
  - Walk speed (always shown)
  - Fly, swim, climb, burrow (shown only if present, with appropriate icons or labels)
  - Use `text-muted-foreground` for secondary speed types
- [ ] **11.3** Add a **Senses** display section showing vision types:
  - "Darkvision 60 ft.", "Blindsight 10 ft.", etc.
  - If empty, show "Normal Vision" or omit
- [ ] **11.4** Add a **Defenses** display section showing:
  - Damage resistances as tags/pills (e.g., "Fire", "Poison")
  - Save advantages as descriptive text
  - Condition immunities
- [ ] **11.5** Update the **Extra Attack** display in the attacks section to use `attacks` from `EvaluationResult` instead of hardcoded values
- [ ] **11.6** All new UI uses semantic Tailwind colors only (`text-primary`, `bg-muted`, `text-destructive`, etc.)

**Verify:** Visual check in the browser. Character sheet should show speed types, vision, and resistances for a Dwarf (darkvision 60, poison resistance, poison save advantage) and Tiefling (darkvision 60, fire resistance).

---

## Step 12: Tests and Verification

- [ ] **12.1** **Schema backward compatibility tests:** Parse the raw SRD JSON data files (in `data/srd-2014/raw/`) through the expanded Zod schemas to confirm existing data passes validation without the new fields
- [ ] **12.2** **Evaluator unit tests:** Extend `lib/engine/__tests__/evaluator.test.ts` with tests for:
  - Race scores flowing into ability score computation
  - Speed aggregation from race + feature sources
  - Vision deduplication (highest range wins per type)
  - Damage resistance union
  - Save text merging
  - Graceful degradation when `sources` is undefined
- [ ] **12.3** **SQL migration dry run:** Run all three migrations (00011, 00012, 00013) against a fresh dev database seeded with `import-srd.ts`. Query results to validate:
  - All 9 SRD races have `scores` arrays
  - Key features (Rage, Sneak Attack, Ki, Action Surge) have `usages` and `recovery`
  - All 12 SRD classes have `attacks` and `improvements` arrays
- [ ] **12.4** **Transformer regression test:** Run `import-srd.ts` after schema changes to confirm no regressions in the import pipeline
- [ ] **12.5** **TypeScript compilation:** `npx tsc --noEmit` clean across the entire project
- [ ] **12.6** **Lint pass:** `npx next lint` clean

---

## File Change Summary

| File | Change Type | Description |
|---|---|---|
| `lib/schemas/content-types/mechanical.ts` | NEW | Shared sub-schemas (speed, vision, savetxt, scores, proficiency grants) |
| `lib/types/taxonomies.ts` | EDIT | Add `VISION_TYPES`, `RECOVERY_TYPES` const arrays |
| `lib/schemas/content-types/race.ts` | EDIT | Add 11 optional fields |
| `lib/schemas/content-types/feature.ts` | EDIT | Add 12 optional fields |
| `lib/schemas/content-types/class.ts` | EDIT | Add 2 optional fields |
| `lib/engine/evaluator.ts` | EDIT | Expand EvaluationResult, add collectStructuredData, wire race scores |
| `lib/types/effects.ts` | EDIT | (Minor) Export SpeedData/VisionEntry types if needed by evaluator |
| `scripts/transformers/races.ts` | EDIT | Populate speed_detail, scores array, categorized proficiencies |
| `scripts/transformers/features.ts` | EDIT | Comment-only (mechanical data is SQL-seeded) |
| `scripts/transformers/classes.ts` | EDIT | Derive improvements from API level features |
| `supabase/migrations/00011_mpmb_race_enrichment.sql` | NEW | Seed 9 SRD races + subraces with MPMB mechanical data |
| `supabase/migrations/00012_mpmb_feature_enrichment.sql` | NEW | Seed ~20 high-impact SRD features with action/usages/recovery/additional |
| `supabase/migrations/00013_mpmb_class_enrichment.sql` | NEW | Seed 12 SRD classes with attacks and improvements arrays |
| `app/.../sheet` components | EDIT | Display speed types, vision, resistances, attacks |
| `lib/engine/__tests__/evaluator.test.ts` | EDIT | New test cases for structured data aggregation |

---

## MPMB Data Sourcing Notes

The SQL migrations (Steps 4-6) require fetching exact values from MPMB. The agent implementing those steps MUST:

1. Fetch `ListsRaces.js` from `https://raw.githubusercontent.com/morepurplemorebetter/MPMBs-Character-Record-Sheet/master/additional%20content/ListsRaces.js` (or the appropriate branch)
2. Fetch `ListsClasses.js` from the same repository
3. Extract the relevant fields for each SRD race/class/feature
4. Cross-reference against the existing `content_definitions` slugs to ensure the `WHERE` clauses match

If the MPMB files are unavailable or the structure has changed, fall back to the D&D 5e SRD PDF for manual extraction of the mechanical values.

---

## Dependency Graph

```
Step 0 (shared types)
  |
  +---> Step 1 (race schema)
  |       |
  |       +---> Step 4 (race SQL migration)
  |       +---> Step 7 (race transformer)
  |
  +---> Step 2 (feature schema)
  |       |
  |       +---> Step 5 (feature SQL migration)
  |       +---> Step 8 (feature transformer — comment only)
  |
  +---> Step 3 (class schema)
          |
          +---> Step 6 (class SQL migration)
          +---> Step 9 (class transformer)

Steps 1-3 (schemas) ---> Step 10 (evaluator)
Step 10 (evaluator)  ---> Step 11 (UI components)
All steps            ---> Step 12 (tests & verification)
```

**Parallelization:** Steps 1, 2, 3 can run in parallel after Step 0. Steps 4, 5, 6 can run in parallel after their respective schema steps. Steps 7, 8, 9 can run in parallel. Step 10 depends on Steps 1-3. Step 11 depends on Step 10. Step 12 is last.
