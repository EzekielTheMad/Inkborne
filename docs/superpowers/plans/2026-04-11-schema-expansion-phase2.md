# Schema Expansion Phase 2: Spell Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand class, feature, and spell schemas with spellcasting fields (spells known, spell lists, bonus spells, cantrip scaling) to support the upcoming spell management UI.

**Architecture:** Extend existing Zod schemas with new optional fields (backward-compatible). SQL migration seeds spellcasting data for all SRD caster classes. No UI changes — data model preparation only.

**Tech Stack:** TypeScript, Zod, Supabase (Postgres)

**Spec:** `docs/superpowers/specs/2026-04-11-mpmb-schema-audit.md` (Phase 2 section)

---

## Critical Rules

- All new schema fields MUST be optional with sensible defaults — existing data must not break on validation
- Use MPMB `ListsClasses.js` and `ListsSpells.js` from GitHub as the data source for enrichment values
- SQL migrations must be idempotent — use `jsonb_set` / merge patterns that don't clobber existing data
- Focus on SRD content only — do not enrich non-SRD content
- No UI changes in this phase — data model preparation only

---

## Step 0: Add Shared Spellcasting Sub-Schemas to mechanical.ts

**File:** `lib/schemas/content-types/mechanical.ts`

Add spellcasting-specific sub-schemas that will be imported by class, feature, and spell schemas. These build on the existing shared types from Phase 1 (speedSchema, visionEntrySchema, savetxtSchema, etc.).

- [ ] **0.1** Add `spellcastingKnownSchema` — tracks how many cantrips and spells a class knows at each level:

```typescript
// Spellcasting known — cantrips/spells known per level for a class
export const spellcastingKnownSchema = z.object({
  cantrips: z.array(z.number().int().nonnegative()).length(20).optional(),
  spells: z.union([
    z.array(z.number().int().nonnegative()).length(20),
    z.literal("all"),
  ]).optional(),
  prepared: z.boolean().default(false),
});
```

- `cantrips`: array of 20 ints — cantrips known at each level (e.g., Wizard: `[3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5]`)
- `spells`: array of 20 ints (known casters like Bard, Sorcerer) OR `"all"` (prepared casters who access the entire class list like Cleric, Druid)
- `prepared`: `true` for prepared casters (Cleric, Druid, Paladin, Wizard), `false` for known casters (Bard, Ranger, Sorcerer, Warlock)

- [ ] **0.2** Add `spellcastingListSchema` — defines which spell list a class draws from:

```typescript
// Spellcasting list reference — which spell list a class uses
export const spellcastingListSchema = z.object({
  class: z.string().min(1),
  level: z.tuple([z.number().int().min(0), z.number().int().min(0).max(9)]),
});
```

- `class`: slug of the class whose spell list applies (e.g., `"wizard"`, `"cleric"`)
- `level`: `[min, max]` spell level range — typically `[0, 9]` for full casters, `[0, 5]` for half casters

- [ ] **0.3** Add `spellcastingExtraSchema` — bonus spells granted at certain class levels (domain spells, expanded spell lists):

```typescript
// Bonus spells granted at certain class/subclass levels
export const spellcastingExtraSchema = z.array(
  z.union([
    z.string().min(1),                  // spell slug at all levels
    z.array(z.string().min(1)),         // array of spell slugs for that tier
  ])
);
```

This is a sparse array indexed by spell level (0-9). Each entry is either a single spell slug or an array of spell slugs granted at that spell level. Example for Life Domain: `[[], ["bless", "cure-wounds"], ["lesser-restoration", "spiritual-weapon"], ...]`

- [ ] **0.4** Add `spellcastingBonusSchema` — features that grant bonus spell access:

```typescript
// Bonus spell access granted by a feature
export const spellcastingBonusSchema = z.object({
  name: z.string().min(1),
  spells: z.array(z.string().min(1)).default([]),
  selection: z.object({
    count: z.number().int().positive(),
    from: z.union([
      z.literal("class"),
      z.literal("any"),
      z.array(z.string().min(1)),
    ]),
    level: z.tuple([z.number().int().min(0), z.number().int().max(9)]).optional(),
    school: z.array(z.string()).optional(),
  }).optional(),
  class: z.string().optional(),
  level: z.number().int().min(0).max(9).optional(),
  prepared: z.boolean().default(false),
  atwill: z.boolean().default(false),
  oncelr: z.boolean().default(false),
  oncesr: z.boolean().default(false),
});
```

- `name`: display name for the bonus spell group (e.g., "Fey Ancestry Cantrip", "Domain Spells")
- `spells`: array of fixed spell slugs this feature grants
- `selection`: if the feature lets the character choose from a list — `count` spells from `from` (class list, any list, or explicit array), optionally filtered by `level` range and `school`
- `class`: which class this bonus applies to (for multiclass disambiguation)
- `level`: spell level constraint
- `prepared`: whether the bonus spells count as always prepared
- `atwill`: can cast at will (no slot required)
- `oncelr` / `oncesr`: can cast once per long/short rest without expending a slot

- [ ] **0.5** Add `cantripDieSchema` — cantrip scaling formula:

```typescript
// Cantrip damage scaling formula
export const cantripDieSchema = z.object({
  die: z.string().min(1),
  levels: z.array(z.number().int().positive()).default([1, 5, 11, 17]),
});
```

- `die`: the die expression per tier (e.g., `"1d10"` for Fire Bolt — becomes 2d10 at 5, 3d10 at 11, 4d10 at 17)
- `levels`: character levels at which the cantrip scales up (default: `[1, 5, 11, 17]` per SRD rules)

- [ ] **0.6** Export TypeScript types via `z.infer<>` for all new schemas:
  - `SpellcastingKnown`
  - `SpellcastingList`
  - `SpellcastingExtra`
  - `SpellcastingBonus`
  - `CantripDie`

**Verify:** `npx tsc --noEmit` passes. No runtime usage yet — these are type definitions only.

---

## Step 1: Expand Class Schema with Spellcasting Fields

**File:** `lib/schemas/content-types/class.ts`

- [ ] **1.1** Import new sub-schemas from `mechanical.ts`:
  - `spellcastingKnownSchema`
  - `spellcastingListSchema`
  - `spellcastingExtraSchema`

- [ ] **1.2** Add the following optional fields to `classDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `spellcastingKnown` | `spellcastingKnownSchema.optional()` | `undefined` | Cantrips/spells known per level, prepared flag |
| `spellcastingList` | `spellcastingListSchema.optional()` | `undefined` | Which spell list this class draws from |
| `spellcastingExtra` | `spellcastingExtraSchema.optional()` | `undefined` | Bonus spells at certain levels (domain spells) |
| `abilitySave` | `z.string().optional()` | `undefined` | Non-caster save DC ability (e.g., Monk Ki save = "wis") |

- [ ] **1.3** Verify that existing spellcasting config (`spellcasting` field with ability/type/focus/ritual_casting) is preserved unchanged — the new fields complement it, they do not replace it

**Verify:** `npx tsc --noEmit` passes. Parse existing class data through the schema to confirm backward compatibility.

---

## Step 2: Expand Feature Schema with Spellcasting Fields

**File:** `lib/schemas/content-types/feature.ts`

- [ ] **2.1** Import new sub-schemas from `mechanical.ts`:
  - `spellcastingBonusSchema`
  - `spellcastingExtraSchema`

- [ ] **2.2** Add the following optional fields to `featureDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `spellcastingBonus` | `z.array(spellcastingBonusSchema).default([])` | `[]` | Bonus spells this feature grants |
| `spellcastingAbility` | `z.string().optional()` | `undefined` | Overrides or sets the spellcasting ability |
| `spellcastingExtra` | `spellcastingExtraSchema.optional()` | `undefined` | Additional known spells per level |
| `fixedDC` | `z.number().int().positive().optional()` | `undefined` | Fixed save DC override (e.g., some magic items) |
| `fixedSpAttack` | `z.number().int().optional()` | `undefined` | Fixed spell attack bonus override |

**Verify:** `npx tsc --noEmit` passes. Parse existing feature data through the schema to confirm backward compatibility.

---

## Step 3: Expand Spell Schema with Full Text and Scaling Fields

**File:** `lib/schemas/content-types/spell.ts`

- [ ] **3.1** Import `cantripDieSchema` from `mechanical.ts`

- [ ] **3.2** Add the following optional fields to `spellDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `descriptionFull` | `z.string().optional()` | `undefined` | Complete SRD rules text (existing `description` kept as abbreviated version) |
| `descriptionCantripDie` | `cantripDieSchema.optional()` | `undefined` | Cantrip scaling formula — die + level thresholds |
| `dependencies` | `z.array(z.string()).default([])` | `[]` | Spell prerequisite chain (spell slugs) |

- [ ] **3.3** The existing `description` field remains unchanged — `descriptionFull` is supplementary. The abbreviated `description` is used for tooltips and quick reference; `descriptionFull` is the complete rules text for the spell detail view

**Verify:** `npx tsc --noEmit` passes. Parse existing spell data through the schema to confirm backward compatibility.

---

## Step 4: SQL Migration — Enrich SRD Caster Classes with spellcastingKnown

**File:** `supabase/migrations/00014_mpmb_spellcasting_known.sql`

Fetch MPMB `ListsClasses.js` from GitHub to get exact spellcastingKnown values for each SRD caster class. Populate by merging into the existing JSONB `data` column.

- [ ] **4.1** Fetch MPMB `ListsClasses.js` from `https://raw.githubusercontent.com/morepurplemorebetter/MPMBs-Character-Record-Sheet/master/additional%20content/ListsClasses.js` to extract `spellcastingKnown` data for each SRD caster class

- [ ] **4.2** Write idempotent SQL for **known casters** (learn a fixed number of spells). These classes have a `spells` array of 20 ints:

```sql
-- Bard — known caster, cantrips + spells known per level
UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'spellcastingKnown', jsonb_build_object(
      'cantrips', '[2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4]'::jsonb,
      'spells', '[4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22]'::jsonb,
      'prepared', false
    ),
    'spellcastingList', jsonb_build_object(
      'class', 'bard',
      'level', '[0,9]'::jsonb
    )
  )
WHERE content_type = 'class'
  AND slug = 'bard'
  AND source = 'srd'
  AND scope = 'platform';
```

- [ ] **4.3** Write idempotent SQL for **Ranger** (known caster, no cantrips, half-caster):

```sql
-- Ranger — known caster, no cantrips, spells known per level
-- spells known: [0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11]
-- (0 at level 1 because Rangers don't get spellcasting until level 2)
```

- [ ] **4.4** Write idempotent SQL for **Sorcerer** (known caster):

```sql
-- Sorcerer — known caster with cantrips
-- cantrips: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6]
-- spells: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15]
```

- [ ] **4.5** Write idempotent SQL for **Warlock** (known caster, pact magic):

```sql
-- Warlock — known caster with cantrips, pact magic
-- cantrips: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4]
-- spells: [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15]
```

- [ ] **4.6** Write idempotent SQL for **prepared casters** (access the entire class spell list, prepare a subset each day). These classes have `spells: "all"`:

```sql
-- Cleric — prepared caster, accesses full cleric spell list
UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'spellcastingKnown', jsonb_build_object(
      'cantrips', '[3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5]'::jsonb,
      'spells', '"all"',
      'prepared', true
    ),
    'spellcastingList', jsonb_build_object(
      'class', 'cleric',
      'level', '[0,9]'::jsonb
    )
  )
WHERE content_type = 'class'
  AND slug = 'cleric'
  AND source = 'srd'
  AND scope = 'platform';
```

- [ ] **4.7** Write idempotent SQL for **Druid** (prepared caster):

```sql
-- Druid — prepared caster, accesses full druid spell list
-- cantrips: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4]
-- spells: "all", prepared: true
```

- [ ] **4.8** Write idempotent SQL for **Paladin** (prepared caster, half-caster, no cantrips):

```sql
-- Paladin — prepared caster, half-caster, no cantrips
-- No cantrips array (paladins don't get cantrips)
-- spells: "all", prepared: true
-- spellcastingList level range: [1, 5] (half caster caps at 5th level spells)
```

- [ ] **4.9** Write idempotent SQL for **Wizard** (prepared caster with spellbook mechanic):

```sql
-- Wizard — prepared caster, spellbook mechanic
-- cantrips: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5]
-- spells: "all", prepared: true
-- Note: Wizard "prepares" from spellbook, not the entire class list,
-- but the schema tracks it as prepared=true; the spellbook filter is a UI concern
```

- [ ] **4.10** Write idempotent SQL for **Eldritch Knight** (Fighter subclass, third caster) and **Arcane Trickster** (Rogue subclass, third caster). These are subclass entries, not class entries:

```sql
-- Eldritch Knight — third caster, known caster
-- Updates content_type = 'subclass', slug = 'eldritch-knight'
-- cantrips: [0,0,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3]
-- spells: [0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13]
-- Note: third casters start spellcasting at class level 3

-- Arcane Trickster — third caster, known caster
-- Updates content_type = 'subclass', slug = 'arcane-trickster'
-- cantrips: [0,0,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4]
-- spells: [0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13]
```

- [ ] **4.11** Wrap the entire migration in a transaction for atomicity

**Verify:** Run the migration against the development database. Query:
```sql
SELECT slug, data->'spellcastingKnown', data->'spellcastingList'
FROM content_definitions
WHERE content_type IN ('class', 'subclass')
  AND source = 'srd'
  AND data ? 'spellcastingKnown';
```
Confirm all 9 SRD caster entries (7 classes + 2 subclasses) have correct values. Spot-check Bard spells known at level 10 = 14, Cleric prepared = true, Ranger has no cantrips array.

---

## Step 5: SQL Migration — Enrich SRD Cantrips with Scaling Formulas

**File:** `supabase/migrations/00015_mpmb_cantrip_scaling.sql`

Fetch MPMB `ListsSpells.js` from GitHub to get `descriptionCantripDie` values for SRD cantrips that deal damage or scale with level.

- [ ] **5.1** Fetch MPMB `ListsSpells.js` from `https://raw.githubusercontent.com/morepurplemorebetter/MPMBs-Character-Record-Sheet/master/additional%20content/ListsSpells.js` to extract cantrip scaling data

- [ ] **5.2** Write idempotent SQL for damage cantrips. Standard SRD cantrips that scale:

```sql
-- Fire Bolt — 1d10 fire, scales at 5/11/17
UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'descriptionCantripDie', jsonb_build_object(
      'die', '1d10',
      'levels', '[1,5,11,17]'::jsonb
    )
  )
WHERE content_type = 'spell'
  AND slug = 'fire-bolt'
  AND source = 'srd'
  AND scope = 'platform';
```

- [ ] **5.3** Cover all SRD damage cantrips that scale with level:
  - **Fire Bolt**: `1d10` fire
  - **Eldritch Blast**: `1d10` force (scales by adding beams, not dice — model as `die: "1d10"` with note that it adds beams)
  - **Sacred Flame**: `1d8` radiant
  - **Chill Touch**: `1d8` necrotic
  - **Ray of Frost**: `1d8` cold
  - **Shocking Grasp**: `1d8` lightning
  - **Acid Splash**: `1d6` acid
  - **Poison Spray**: `1d12` poison
  - **Toll the Dead**: `1d8`/`1d12` necrotic (conditional — use `1d12` as the scaling die)
  - **Produce Flame**: `1d8` fire
  - **Vicious Mockery**: `1d4` psychic

- [ ] **5.4** Cover SRD cantrips that scale non-damage effects:
  - For cantrips like **Light**, **Mending**, **Prestidigitation** — these do not have a `descriptionCantripDie` (they do not scale). Skip them

- [ ] **5.5** Also populate `descriptionFull` with the complete SRD rules text for all cantrips that received `descriptionCantripDie`. The existing `description` field contains abbreviated text from the API; `descriptionFull` should be the complete rules text from the SRD:

```sql
-- Example: Fire Bolt
UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'descriptionFull', 'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn''t being worn or carried. This spell''s damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).'
  )
WHERE content_type = 'spell'
  AND slug = 'fire-bolt'
  AND source = 'srd'
  AND scope = 'platform';
```

Note: Combine the `descriptionCantripDie` and `descriptionFull` updates into a single `jsonb_build_object` merge per spell to avoid multiple UPDATE passes.

- [ ] **5.6** Wrap the entire migration in a transaction for atomicity

**Verify:** Query:
```sql
SELECT slug, data->'descriptionCantripDie', data->'descriptionFull'
FROM content_definitions
WHERE content_type = 'spell'
  AND data ? 'descriptionCantripDie'
  AND source = 'srd';
```
Confirm all scaling cantrips have the die formula. Spot-check Fire Bolt die = "1d10", levels = [1,5,11,17].

---

## Step 6: Update Class Transformer for Spellcasting Data

**File:** `scripts/transformers/classes.ts`

The dnd5eapi API provides `cantrips_known` per level and `spellcasting_ability`, but does NOT provide spells known counts or prepared status. The transformer can partially derive `spellcastingKnown.cantrips` from the API; everything else is MPMB-seeded via SQL migration.

- [ ] **6.1** Extract cantrips known per level from the existing API level data. The transformer already reads `lvl.spellcasting?.cantrips_known` for each level. Build a `cantrips` array from this:

```typescript
// Derive cantrips known array from API level data
const cantripsKnown = sortedLevels
  .map((lvl) => lvl.spellcasting?.cantrips_known ?? 0);
const hasCantrips = cantripsKnown.some((c) => c > 0);
```

- [ ] **6.2** If the class has spellcasting, include a partial `spellcastingKnown` in the output:

```typescript
...(hasCantrips ? {
  spellcastingKnown: {
    cantrips: cantripsKnown,
    // spells and prepared are MPMB-seeded via SQL migration 00014
  }
} : {}),
```

- [ ] **6.3** Derive `spellcastingList` from the class slug and spellcasting type:

```typescript
...(spellcasting ? {
  spellcastingList: {
    class: apiClass.index,
    level: [0, mapSpellcastingType(apiClass.index) === "half" ? 5 : 9],
  }
} : {}),
```

- [ ] **6.4** Add a comment documenting that `spellcastingKnown.spells`, `spellcastingKnown.prepared`, and `spellcastingExtra` are MPMB-seeded via SQL migration

**Verify:** Run `npx tsx scripts/import-srd.ts` in dry-run mode. Confirm class data includes partial `spellcastingKnown` with cantrips array for caster classes and `spellcastingList` for all casters. Non-casters should have neither field.

---

## Step 7: Update Spell Transformer for New Fields

**File:** `scripts/transformers/spells.ts`

The dnd5eapi provides `desc` (abbreviated) but not full rules text or cantrip scaling formulas. The transformer can set `descriptionFull` from the API's `desc` field (which is actually already the full SRD text for most spells), and leave `descriptionCantripDie` for MPMB enrichment.

- [ ] **7.1** Add `descriptionFull` to the spell data output, using the full joined description text from the API:

```typescript
descriptionFull: apiSpell.desc.join("\n"),
```

This gives us a reasonable starting point — the API's `desc` field already contains the full SRD text. The SQL migration may overwrite with MPMB-sourced text if it differs.

- [ ] **7.2** Initialize `dependencies` as an empty array in the transformer output:

```typescript
dependencies: [],
```

- [ ] **7.3** Add a comment noting that `descriptionCantripDie` is MPMB-seeded via SQL migration 00015

**Verify:** Run transformer. Confirm spell data includes `descriptionFull` and `dependencies` fields. Existing `description` field remains unchanged.

---

## Step 8: Tests and Verification

- [ ] **8.1** **Schema backward compatibility tests:** Parse the existing SRD content data (from a database export or `data/srd-2014/raw/` if available) through the expanded Zod schemas to confirm existing data passes validation without the new optional fields:
  - `classDataSchema.parse(existingClassData)` — must pass for all 12 SRD classes
  - `featureDataSchema.parse(existingFeatureData)` — must pass for all existing features
  - `spellDataSchema.parse(existingSpellData)` — must pass for all existing spells

- [ ] **8.2** **New field validation tests:** Write unit tests that construct objects with the new fields and validate:
  - `classDataSchema.parse(classWithSpellcastingKnown)` — Bard-like class with cantrips + spells arrays
  - `classDataSchema.parse(classWithPreparedCasting)` — Cleric-like class with spells = "all", prepared = true
  - `featureDataSchema.parse(featureWithSpellcastingBonus)` — feature granting bonus cantrip
  - `spellDataSchema.parse(spellWithCantripDie)` — Fire Bolt with descriptionCantripDie
  - Verify defaults: `spellcastingBonus` defaults to `[]`, `dependencies` defaults to `[]`

- [ ] **8.3** **SQL migration dry run:** Run both migrations (00014, 00015) against a fresh dev database seeded with `import-srd.ts`. Query results to validate:
  - All 7 SRD caster classes have `spellcastingKnown` with correct cantrips arrays
  - Prepared flag is `true` for Cleric, Druid, Paladin, Wizard and `false` for Bard, Ranger, Sorcerer, Warlock
  - Eldritch Knight and Arcane Trickster subclasses have spellcasting data
  - All damage-scaling cantrips have `descriptionCantripDie`

- [ ] **8.4** **Transformer regression test:** Run `npx tsx scripts/import-srd.ts` after schema changes to confirm no regressions in the import pipeline. All content should still parse and upsert cleanly

- [ ] **8.5** **TypeScript compilation:** `npx tsc --noEmit` clean across the entire project

- [ ] **8.6** **Lint pass:** `npx next lint` clean

---

## File Change Summary

| File | Change Type | Description |
|---|---|---|
| `lib/schemas/content-types/mechanical.ts` | EDIT | Add spellcastingKnownSchema, spellcastingListSchema, spellcastingExtraSchema, spellcastingBonusSchema, cantripDieSchema |
| `lib/schemas/content-types/class.ts` | EDIT | Add spellcastingKnown, spellcastingList, spellcastingExtra, abilitySave fields |
| `lib/schemas/content-types/feature.ts` | EDIT | Add spellcastingBonus, spellcastingAbility, spellcastingExtra, fixedDC, fixedSpAttack fields |
| `lib/schemas/content-types/spell.ts` | EDIT | Add descriptionFull, descriptionCantripDie, dependencies fields |
| `scripts/transformers/classes.ts` | EDIT | Derive partial spellcastingKnown.cantrips and spellcastingList from API data |
| `scripts/transformers/spells.ts` | EDIT | Add descriptionFull from API desc, initialize dependencies |
| `supabase/migrations/00014_mpmb_spellcasting_known.sql` | NEW | Seed 7 SRD caster classes + 2 subclasses with spellcastingKnown/List data |
| `supabase/migrations/00015_mpmb_cantrip_scaling.sql` | NEW | Seed ~11 SRD damage cantrips with descriptionCantripDie + descriptionFull |

---

## MPMB Data Sourcing Notes

The SQL migrations (Steps 4-5) require fetching exact values from MPMB. The agent implementing those steps MUST:

1. Fetch `ListsClasses.js` from `https://raw.githubusercontent.com/morepurplemorebetter/MPMBs-Character-Record-Sheet/master/additional%20content/ListsClasses.js`
2. Fetch `ListsSpells.js` from the same repository
3. Extract `spellcastingKnown` (cantrips, spells, prepared) for each SRD caster class
4. Extract `descriptionCantripDie` for each SRD damage cantrip
5. Cross-reference against the existing `content_definitions` slugs to ensure the `WHERE` clauses match

If the MPMB files are unavailable or the structure has changed, fall back to the D&D 5e SRD PDF and PHB spellcasting tables for manual extraction of the known/prepared values.

**Key MPMB field mappings:**
- `ClassList["bard"].spellcastingKnown` -> `spellcastingKnown` schema
- `ClassList["bard"].spellcastingList` -> `spellcastingList` schema
- `SpellsList["fire bolt"].descriptionCantripDie` -> `descriptionCantripDie` schema
- Subclass spellcasting data is typically in `ClassSubList["eldritch knight"].spellcastingKnown`

---

## Dependency Graph

```
Step 0 (shared spellcasting sub-schemas)
  |
  +---> Step 1 (class schema expansion)
  |       |
  |       +---> Step 4 (spellcastingKnown SQL migration)
  |       +---> Step 6 (class transformer update)
  |
  +---> Step 2 (feature schema expansion)
  |
  +---> Step 3 (spell schema expansion)
          |
          +---> Step 5 (cantrip scaling SQL migration)
          +---> Step 7 (spell transformer update)

All steps ---> Step 8 (tests & verification)
```

**Parallelization:** Steps 1, 2, 3 can run in parallel after Step 0. Steps 4 and 5 can run in parallel after their respective schema steps. Steps 6 and 7 can run in parallel. Step 8 is last.

---

## What This Phase Does NOT Cover

These are explicitly out of scope and will be addressed in later phases:

- **Spell management UI** — spell selection, preparation, slot tracking (separate sub-project)
- **spellChanges** — runtime spell modifications from features (Phase 3: calcChanges system)
- **Evaluator integration** — wiring spellcasting data into the expression engine (spell management UI phase)
- **Race innate spellcasting** — `spellcastingAbility` and `spellcastingBonus` on races (deferred; the race schema addition is trivial once the feature sub-schemas exist, and will be added when the first race feature needs it)
- **Feat spellcasting grants** — feats that grant spells like Magic Initiate (Phase 3: feat expansion)
