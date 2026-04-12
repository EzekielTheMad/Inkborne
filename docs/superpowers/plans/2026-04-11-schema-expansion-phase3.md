# Schema Expansion Phase 3: Homebrew & Full Automation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand feat, background, class, feature, and weapon schemas with remaining mechanical fields to complete the data model for homebrew content creation and full automation.

**Architecture:** Extend existing Zod schemas with optional fields (backward-compatible). SQL migrations seed remaining SRD data. This completes the MPMB-aligned data model.

**Tech Stack:** TypeScript, Zod, Supabase (Postgres)

**Spec:** `docs/superpowers/specs/2026-04-11-mpmb-schema-audit.md` (Phase 3 section)

---

## Critical Rules

- All new schema fields MUST be optional with sensible defaults — existing data must not break on validation
- Reuse sub-schemas from `mechanical.ts` wherever possible (speedSchema, visionEntrySchema, savetxtSchema, abilityScoreArraySchema, ACTION_TYPES, RECOVERY_TYPES, sourceRefsSchema, proficiencyGrantsSchema, spellcastingBonusSchema)
- SQL migrations must be idempotent — use `jsonb_set` / merge patterns that don't clobber existing data
- Focus on SRD content only for migrations — do not enrich non-SRD content
- No UI changes in this phase — data model preparation only

---

## Step 0: Add Shared Sub-Schemas to mechanical.ts

**File:** `lib/schemas/content-types/mechanical.ts`

Add sub-schemas that will be imported by multiple content-type schemas in this phase.

- [ ] **0.1** Add `languageProfsSchema` — language proficiency grants with optional count for "choose N" mechanics:

```typescript
// Language proficiency grants — fixed languages or "choose N from any"
export const languageProfsSchema = z.array(
  z.union([
    z.string().min(1),           // fixed language slug: "elvish", "dwarvish"
    z.object({                   // choice: "choose N"
      choose: z.number().int().positive(),
      from: z.union([z.literal("any"), z.array(z.string().min(1))]),
    }),
  ])
).default([]);
```

- `"elvish"` — grants Elvish automatically
- `{ choose: 1, from: "any" }` — choose 1 language from any
- `{ choose: 1, from: ["elvish", "sylvan"] }` — choose 1 from list

- [ ] **0.2** Add `toolProfsSchema` — tool proficiency grants with optional choice mechanics:

```typescript
// Tool proficiency grants
export const toolProfsSchema = z.array(
  z.union([
    z.string().min(1),           // fixed tool slug: "thieves-tools"
    z.object({
      choose: z.number().int().positive(),
      from: z.union([z.literal("any"), z.array(z.string().min(1))]),
    }),
  ])
).default([]);
```

- [ ] **0.3** Add `skillProfsSchema` — skill proficiency grants:

```typescript
// Skill proficiency grants
export const skillProfsSchema = z.array(z.string().min(1)).default([]);
```

- [ ] **0.4** Add `equipmentDescSchema` — human-readable equipment description text for starting equipment options:

```typescript
// Starting equipment description text
export const equipmentDescSchema = z.string().default("");
```

- [ ] **0.5** Add `calcChangesSchema` — the conditional modifier system for attack/spell calculations. This is a declarative model representing MPMB's JS-function-based `calcChanges`:

```typescript
// Conditional modifier — declarative version of MPMB calcChanges
export const calcChangeEntrySchema = z.object({
  target: z.enum(["atkCalc", "atkAdd", "spellCalc", "spellAdd", "hp"]),
  condition: z.string().default(""),       // human-readable condition description
  value: z.union([z.number(), z.string()]).optional(),  // numeric bonus or formula
  description: z.string().min(1),          // what this modifier does
});
export type CalcChangeEntry = z.infer<typeof calcChangeEntrySchema>;

export const calcChangesSchema = z.array(calcChangeEntrySchema).default([]);
```

- [ ] **0.6** Add `addModSchema` — modifier additions (MPMB addMod equivalent):

```typescript
// Modifier addition — adds to a specific computed field
export const addModEntrySchema = z.object({
  type: z.string().min(1),     // modifier type: "save", "skill", etc.
  field: z.string().min(1),    // specific field: "Str", "Athletics", etc.
  mod: z.union([z.number(), z.string()]),  // bonus value or formula
  text: z.string().default(""),
});
export type AddModEntry = z.infer<typeof addModEntrySchema>;

export const addModSchema = z.array(addModEntrySchema).default([]);
```

- [ ] **0.7** Export TypeScript types via `z.infer<>` for all new schemas:
  - `LanguageProfs`
  - `ToolProfs`
  - `CalcChangeEntry`, `AddModEntry`

**Verify:** `npx tsc --noEmit` passes. No runtime usage yet — these are type definitions only.

---

## Step 1: Expand Feat Schema

**File:** `lib/schemas/content-types/feat.ts`

The feat schema is currently nearly empty (description + prerequisites only). This is the biggest single expansion — feats need the full suite of mechanical fields to support homebrew feats with real automation.

- [ ] **1.1** Import sub-schemas from `mechanical.ts`:
  - `abilityScoreArraySchema`, `speedSchema`, `visionEntrySchema`, `savetxtSchema`
  - `ACTION_TYPES`, `RECOVERY_TYPES`
  - `sourceRefsSchema`, `proficiencyGrantsSchema`
  - `spellcastingBonusSchema`
  - `languageProfsSchema`, `toolProfsSchema`, `skillProfsSchema`
  - `calcChangesSchema`, `addModSchema`

- [ ] **1.2** Add the following optional fields to `featDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `scores` | `abilityScoreArraySchema.optional()` | `undefined` | Ability score bonuses [STR,DEX,CON,INT,WIS,CHA] |
| `scoresMaximum` | `abilityScoreArraySchema.optional()` | `undefined` | Ability score cap overrides |
| `scorestxt` | `z.string().optional()` | `undefined` | Human-readable score description |
| `action` | `z.enum(ACTION_TYPES).nullable().default(null)` | `null` | Action economy type |
| `usages` | `z.union([z.number(), z.array(z.number().nullable()).length(20)]).optional()` | `undefined` | Usage limits — flat number or per-level array |
| `recovery` | `z.enum(RECOVERY_TYPES).nullable().default(null)` | `null` | Recovery timing |
| `speed` | `speedSchema.optional()` | `undefined` | Speed modifications by type |
| `vision` | `z.array(visionEntrySchema).default([])` | `[]` | Vision grants (darkvision, etc.) |
| `dmgres` | `z.array(z.string()).default([])` | `[]` | Damage resistances |
| `savetxt` | `savetxtSchema.optional()` | `undefined` | Save advantages/immunities |
| `skills` | `skillProfsSchema` | `[]` | Skill proficiency grants |
| `skillstxt` | `z.string().optional()` | `undefined` | Skill choice description |
| `weaponProfs` | `z.array(z.string()).default([])` | `[]` | Weapon proficiency grants |
| `armorProfs` | `z.array(z.string()).default([])` | `[]` | Armor proficiency grants |
| `toolProfs` | `toolProfsSchema` | `[]` | Tool proficiency grants |
| `languageProfs` | `languageProfsSchema` | `[]` | Language grants |
| `extraAC` | `z.number().optional()` | `undefined` | AC bonus |
| `spellcastingBonus` | `z.array(spellcastingBonusSchema).default([])` | `[]` | Spell grants from feat |
| `spellcastingAbility` | `z.string().optional()` | `undefined` | Spellcasting ability from feat |
| `extraLimitedFeatures` | (same schema as feature.ts) | `[]` | Additional limited-use resources |
| `calcChanges` | `calcChangesSchema` | `[]` | Attack/spell calc modifications |
| `addMod` | `addModSchema` | `[]` | Modifier additions |
| `source_refs` | `sourceRefsSchema` | `[]` | Source book references |

- [ ] **1.3** Verify backward compatibility: the existing `description` and `prerequisites` fields remain unchanged. Parsing existing feat data with the expanded schema must succeed because all new fields have defaults or are optional.

**Verify:** `npx tsc --noEmit` passes. Parse existing SRD feat data through the expanded schema.

---

## Step 2: Expand Background Schema

**File:** `lib/schemas/content-types/background.ts`

Backgrounds currently have only roleplay data (feature, personality traits, ideals, bonds, flaws). Add structured proficiency and equipment data so backgrounds can contribute mechanically to character creation.

- [ ] **2.1** Import sub-schemas from `mechanical.ts`:
  - `sourceRefsSchema`, `languageProfsSchema`, `toolProfsSchema`, `skillProfsSchema`

- [ ] **2.2** Add the following optional fields to `backgroundDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `skills` | `skillProfsSchema` | `[]` | Skill proficiency array (e.g., ["insight", "religion"]) |
| `gold` | `z.number().nonnegative().optional()` | `undefined` | Starting gold amount |
| `languageProfs` | `languageProfsSchema` | `[]` | Language proficiency grants |
| `toolProfs` | `toolProfsSchema` | `[]` | Tool proficiency grants |
| `equipment` | `z.string().default("")` | `""` | Starting equipment description |
| `variant` | `z.string().nullable().default(null)` | `null` | Slug of parent background if this is a variant |
| `source_refs` | `sourceRefsSchema` | `[]` | Source book references |

- [ ] **2.3** Verify backward compatibility: existing personality/ideals/bonds/flaws fields and the feature object remain unchanged.

**Verify:** `npx tsc --noEmit` passes. Parse existing SRD background data through the expanded schema.

---

## Step 3: Expand Class Schema

**File:** `lib/schemas/content-types/class.ts`

Classes currently track hit_die, spellcasting, multiclass, saving_throws, starting_proficiencies, and levels. Phase 1 added attacks/improvements. Phase 2 added spellcastingKnown/List/Extra. Phase 3 adds proficiency structure, display metadata, and equipment.

- [ ] **3.1** Import sub-schemas from `mechanical.ts`:
  - `languageProfsSchema`, `toolProfsSchema`

- [ ] **3.2** Add the following optional fields to `classDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `primaryAbility` | `z.string().optional()` | `undefined` | Primary ability score string for display (e.g., "Strength" for Fighter) |
| `skillstxt` | `z.string().optional()` | `undefined` | Skill choice description (e.g., "Choose two from Acrobatics, Athletics...") |
| `armorProfs` | (see below) | `undefined` | Structured armor proficiencies |
| `weaponProfs` | (see below) | `undefined` | Structured weapon proficiencies |
| `toolProfs` | `toolProfsSchema.optional()` | `undefined` | Tool proficiency grants |
| `equipment` | `z.string().optional()` | `undefined` | Starting equipment options description |
| `subclassLabel` | `z.string().optional()` | `undefined` | Subclass category name (e.g., "Primal Path", "Arcane Tradition") |

- [ ] **3.3** Define `armorProfs` and `weaponProfs` as objects with primary (level 1) and secondary (multiclass) arrays — this is needed because multiclassing grants a subset of proficiencies:

```typescript
// Proficiency split — primary (full class) vs secondary (multiclass gain)
const classProfArraySchema = z.object({
  primary: z.array(z.string()).default([]),
  secondary: z.array(z.string()).default([]),
});
```

Add to `classDataSchema`:
```typescript
armorProfs: classProfArraySchema.optional(),
weaponProfs: classProfArraySchema.optional(),
```

This complements the existing flat `starting_proficiencies` array (which remains for backward compatibility) with structured data that the character builder can use to correctly apply proficiencies on multiclass.

- [ ] **3.4** Verify that the existing `starting_proficiencies`, `spellcasting`, `multiclass`, `levels`, Phase 1 fields (attacks, improvements), and Phase 2 fields (spellcastingKnown, spellcastingList, spellcastingExtra, abilitySave) all remain unchanged.

**Verify:** `npx tsc --noEmit` passes. Parse existing SRD class data through the expanded schema.

---

## Step 4: Expand Feature Schema

**File:** `lib/schemas/content-types/feature.ts`

Features already have the richest schema from Phase 1+2 (action economy, usages, recovery, scores, vision, speed, dmgres, savetxt, extraAC, spellcasting). Phase 3 adds the remaining MPMB fields: calc modifiers, choice dependencies, prerequisite descriptions, and language grants.

- [ ] **4.1** Import sub-schemas from `mechanical.ts`:
  - `calcChangesSchema`, `addModSchema`, `languageProfsSchema`

- [ ] **4.2** Add the following optional fields to `featureDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `calcChanges` | `calcChangesSchema` | `[]` | Conditional modifiers (atkCalc, spellCalc, etc.) |
| `addMod` | `addModSchema` | `[]` | Direct modifier additions |
| `languageProfs` | `languageProfsSchema` | `[]` | Language grants from features |
| `carryingCapacity` | `z.number().optional()` | `undefined` | Carrying capacity multiplier (e.g., 2 for Bear Totem) |
| `prereqeval` | `z.string().optional()` | `undefined` | Human-readable prerequisite description |
| `choices` | (see below) | `undefined` | Structured multi-selection system |
| `extrachoices` | (see below) | `undefined` | Additional choices beyond normal selection |
| `weaponOptions` | (see below) | `[]` | Dynamic weapon creation |
| `armorOptions` | (see below) | `[]` | Dynamic armor creation |

- [ ] **4.3** Define `choices` and `extrachoices` — these extend the existing `choice` feature_type with structured metadata for multi-selection features like Eldritch Invocations or Maneuvers:

```typescript
// Structured choice definition for multi-selection features
const featureChoiceSchema = z.object({
  name: z.string().min(1),               // choice group name
  count: z.number().int().positive(),    // how many to pick
  options: z.array(z.string().min(1)),   // available option slugs
  prereq: z.string().optional(),         // prerequisite description
});

// In featureDataSchema:
choices: z.array(featureChoiceSchema).default([]),
extrachoices: z.array(featureChoiceSchema).default([]),
```

- `choices`: standard selections at the feature's level
- `extrachoices`: additional selections beyond the normal count (e.g., extra invocations from specific features)

- [ ] **4.4** Define `weaponOptions` and `armorOptions` — dynamic item creation from features (e.g., Sun Soul Monk's radiant sun bolt):

```typescript
// Dynamic weapon/armor creation from a feature
const weaponOptionSchema = z.object({
  name: z.string().min(1),
  baseWeapon: z.string().optional(),      // parent weapon slug for inheritance
  damage: z.object({
    dice: z.string().min(1),
    type: z.string().min(1),
  }).optional(),
  range: z.object({
    normal: z.number().positive(),
    long: z.number().positive().optional(),
  }).optional(),
  ability: z.number().int().min(0).max(6).optional(),
  description: z.string().default(""),
});

const armorOptionSchema = z.object({
  name: z.string().min(1),
  ac: z.number().int().nonnegative(),
  dex_bonus: z.boolean().default(false),
  max_bonus: z.number().int().nullable().default(null),
  description: z.string().default(""),
});

// In featureDataSchema:
weaponOptions: z.array(weaponOptionSchema).default([]),
armorOptions: z.array(armorOptionSchema).default([]),
```

- [ ] **4.5** Verify that all Phase 1 fields (action, usages, recovery, additional, scores, scoresMaximum, vision, speed, dmgres, savetxt, extraAC, extraLimitedFeatures) and Phase 2 fields (spellcastingBonus, spellcastingAbility, spellcastingExtra, fixedDC, fixedSpAttack) remain unchanged.

**Verify:** `npx tsc --noEmit` passes. Parse existing SRD feature data through the expanded schema.

---

## Step 5: Expand Weapon Schema

**File:** `lib/schemas/content-types/weapon.ts`

Weapons currently have category, range, cost, weight, damage, properties, and two_handed_damage. Add ability modifier control, extended type support, monk weapon flag, ammo reference, and weapon inheritance.

- [ ] **5.1** Extend `WEAPON_CATEGORIES` (or the local type) to include extended types. Check `lib/types/taxonomies.ts` for where `WEAPON_CATEGORIES` is defined. Add new categories if needed:

```typescript
// Extended weapon types beyond Simple/Martial
// "Natural" — unarmed strike, beast attacks
// "Cantrip" — cantrip-based weapon entries (e.g., Booming Blade)
// "Spell" — spell-based weapon entries
// "Improvised" — improvised weapons
```

If `WEAPON_CATEGORIES` is an enum tuple in taxonomies, add the new values there. If it's already broad enough, skip this sub-step.

- [ ] **5.2** Add the following optional fields to `weaponDataSchema`:

| Field | Schema | Default | Notes |
|---|---|---|---|
| `ability` | `z.number().int().min(0).max(6).optional()` | `undefined` | Explicit ability modifier: 1=STR, 2=DEX, 3=CON, 4=INT, 5=WIS, 6=CHA, 0=none. Omit to use standard rules (STR for melee, DEX for ranged/finesse) |
| `monkweapon` | `z.boolean().default(false)` | `false` | Monk weapon compatibility flag |
| `ammo` | `z.string().nullable().default(null)` | `null` | Ammunition type slug reference (e.g., "arrow", "bolt") |
| `baseWeapon` | `z.string().nullable().default(null)` | `null` | Parent weapon slug for variant inheritance (e.g., a magic longsword inherits from "longsword") |
| `source_refs` | `sourceRefsSchema` | `[]` | Source book references |

- [ ] **5.3** Import `sourceRefsSchema` from `mechanical.ts` at the top of the file.

- [ ] **5.4** Verify backward compatibility: existing fields (weapon_category, weapon_range, cost, weight, damage, range, properties, two_handed_damage) remain unchanged.

**Verify:** `npx tsc --noEmit` passes. Parse existing SRD weapon data through the expanded schema.

---

## Step 6: SQL Migration — Enrich SRD Feats, Backgrounds, and Classes

### Step 6A: Enrich SRD Feat — Grappler

**File:** `supabase/migrations/00016_phase3_feat_enrichment.sql`

The SRD contains only one feat: Grappler. Seed it with mechanical effects.

- [ ] **6A.1** Fetch MPMB `ListsFeats.js` from `https://raw.githubusercontent.com/morepurplemorebetter/MPMBs-Character-Record-Sheet/master/additional%20content/ListsFeats.js` to extract Grappler data.

- [ ] **6A.2** Write idempotent SQL to enrich the Grappler feat:

```sql
BEGIN;

-- Grappler feat — STR 13 prerequisite (already in prerequisites),
-- grants advantage on attack rolls against creatures you are grappling
UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'savetxt', jsonb_build_object(
      'adv_vs', '["grappled creatures (attack rolls)"]'::jsonb,
      'immune', '[]'::jsonb
    ),
    'source_refs', '[{"book": "SRD", "page": 0}]'::jsonb
  )
WHERE content_type = 'feat'
  AND slug = 'grappler'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
```

Note: Grappler's mechanical effects are limited — mainly advantage on attacks vs grappled targets and the ability to pin. The structured data captures what can be automated; the rest remains in the description.

- [ ] **6A.3** Wrap in a transaction.

**Verify:** Query `SELECT slug, data FROM content_definitions WHERE content_type = 'feat' AND source = 'srd';` — confirm Grappler has `savetxt` and `source_refs`.

### Step 6B: Enrich SRD Backgrounds with Proficiency Data

**File:** `supabase/migrations/00017_phase3_background_enrichment.sql`

Seed SRD backgrounds with structured skill, tool, language, and equipment data. The API provides this in effects, but not in structured `data` fields.

- [ ] **6B.1** Fetch MPMB `ListsBackgrounds.js` from GitHub to extract proficiency data for each SRD background.

- [ ] **6B.2** Write idempotent SQL for **Acolyte**:

```sql
BEGIN;

UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'skills', '["insight", "religion"]'::jsonb,
    'languageProfs', '[{"choose": 2, "from": "any"}]'::jsonb,
    'toolProfs', '[]'::jsonb,
    'gold', 15,
    'equipment', 'A holy symbol, a prayer book or prayer wheel, 5 sticks of incense, vestments, a set of common clothes, and a pouch containing 15 gp',
    'source_refs', '[{"book": "SRD", "page": 0}]'::jsonb
  )
WHERE content_type = 'background'
  AND slug = 'acolyte'
  AND source = 'srd'
  AND scope = 'platform';
```

- [ ] **6B.3** Write idempotent SQL for remaining SRD backgrounds. For each background, populate `skills`, `languageProfs`, `toolProfs`, `gold`, and `equipment`. The SRD backgrounds from dnd5eapi are:
  - **Acolyte**: skills=[insight, religion], languages=choose 2, gold=15
  - Other SRD backgrounds (if present): follow the same pattern

Note: The 2014 SRD only includes Acolyte. If additional backgrounds exist in the database from the API, enrich them as well. Use the API's `starting_proficiencies` data to derive the structured fields.

- [ ] **6B.4** Wrap in a transaction.

**Verify:** Query backgrounds with new fields. Confirm Acolyte has skills, languageProfs, and equipment.

### Step 6C: Enrich SRD Classes with Phase 3 Fields

**File:** `supabase/migrations/00018_phase3_class_enrichment.sql`

Add primaryAbility, skillstxt, subclassLabel, equipment, and structured proficiency arrays to SRD classes.

- [ ] **6C.1** Fetch MPMB `ListsClasses.js` from GitHub to extract Phase 3 fields.

- [ ] **6C.2** Write idempotent SQL for each SRD class. Example for **Barbarian**:

```sql
BEGIN;

UPDATE content_definitions
SET data = data
  || jsonb_build_object(
    'primaryAbility', 'Strength',
    'skillstxt', 'Choose two from Animal Handling, Athletics, Intimidation, Nature, Perception, and Survival',
    'subclassLabel', 'Primal Path',
    'equipment', 'A greataxe or any martial melee weapon; two handaxes or any simple weapon; an explorer''s pack and four javelins',
    'armorProfs', jsonb_build_object(
      'primary', '["light", "medium", "shields"]'::jsonb,
      'secondary', '["shields"]'::jsonb
    ),
    'weaponProfs', jsonb_build_object(
      'primary', '["simple", "martial"]'::jsonb,
      'secondary', '[]'::jsonb
    ),
    'toolProfs', '[]'::jsonb
  )
WHERE content_type = 'class'
  AND slug = 'barbarian'
  AND source = 'srd'
  AND scope = 'platform';
```

- [ ] **6C.3** Repeat for all 12 SRD classes with correct values:
  - **Barbarian**: primary=Strength, subclass="Primal Path"
  - **Bard**: primary=Charisma, subclass="Bard College"
  - **Cleric**: primary=Wisdom, subclass="Divine Domain"
  - **Druid**: primary=Wisdom, subclass="Druid Circle"
  - **Fighter**: primary=Strength or Dexterity, subclass="Martial Archetype"
  - **Monk**: primary=Dexterity & Wisdom, subclass="Monastic Tradition"
  - **Paladin**: primary=Strength & Charisma, subclass="Sacred Oath"
  - **Ranger**: primary=Dexterity & Wisdom, subclass="Ranger Archetype"
  - **Rogue**: primary=Dexterity, subclass="Roguish Archetype"
  - **Sorcerer**: primary=Charisma, subclass="Sorcerous Origin"
  - **Warlock**: primary=Charisma, subclass="Otherworldly Patron"
  - **Wizard**: primary=Intelligence, subclass="Arcane Tradition"

- [ ] **6C.4** For each class, populate `armorProfs` and `weaponProfs` with primary (level 1) and secondary (multiclass) arrays. Reference PHB multiclassing proficiency table.

- [ ] **6C.5** Wrap in a transaction.

**Verify:** Query classes with new fields. Spot-check Barbarian has subclassLabel="Primal Path", Wizard has primaryAbility="Intelligence", Fighter armorProfs.secondary includes "light", "medium", "shields".

---

## Step 7: Update Transformers

### Step 7A: Update Feat Transformer

**File:** `scripts/transformers/feats.ts`

- [ ] **7A.1** Add `source_refs: [{ book: "SRD", page: 0 }]` to the feat data output. The API does not provide mechanical feat data beyond description and prerequisites, so the transformer only adds the source ref. All other mechanical fields are MPMB-seeded via SQL migration.

- [ ] **7A.2** Add a comment documenting that scores, action, usages, recovery, speed, vision, dmgres, savetxt, proficiencies, extraAC, spellcastingBonus, calcChanges, and addMod are populated via SQL migration 00016 or via homebrew creation UI.

### Step 7B: Update Background Transformer

**File:** `scripts/transformers/backgrounds.ts`

- [ ] **7B.1** Extract skill proficiencies from the API's `starting_proficiencies` and populate the new `skills` field:

```typescript
// Extract skill proficiencies from API starting_proficiencies
const skills = bg.starting_proficiencies
  .filter((p) => p.index.startsWith("skill-"))
  .map((p) => normalizeSlug(p.index.replace("skill-", "")));
```

- [ ] **7B.2** Extract tool proficiencies from the API's `starting_proficiencies`:

```typescript
const toolProfs = bg.starting_proficiencies
  .filter((p) => !p.index.startsWith("skill-"))
  .map((p) => normalizeSlug(p.index));
```

- [ ] **7B.3** Derive language proficiency data from the existing `language_options`:

```typescript
const languageProfs = bg.language_options
  ? [{ choose: bg.language_options.choose, from: "any" as const }]
  : [];
```

- [ ] **7B.4** Add `source_refs: [{ book: "SRD", page: 0 }]` to the background data output.

- [ ] **7B.5** Include the new fields in the `buildContentEntry` call:

```typescript
return buildContentEntry("background", bg.index, bg.name, {
  feature: { ... },
  personality_traits: ...,
  ideals: ...,
  bonds: ...,
  flaws: ...,
  // Phase 3 fields
  skills,
  toolProfs,
  languageProfs,
  source_refs: [{ book: "SRD", page: 0 }],
  // gold and equipment are MPMB-seeded via SQL migration 00017
}, effects);
```

### Step 7C: Update Class Transformer

**File:** `scripts/transformers/classes.ts`

- [ ] **7C.1** Add `source_refs: [{ book: "SRD", page: 0 }]` to class data output.

- [ ] **7C.2** Extract skill choice text from the API's `proficiency_choices`. Build a `skillstxt` description:

```typescript
// Derive skillstxt from proficiency choices
const skillChoices = apiClass.proficiency_choices
  .filter((c) => c.from.options.some((o) => o.item?.index?.startsWith("skill-")));
const skillstxt = skillChoices.length > 0
  ? `Choose ${skillChoices[0].choose} from ${
      skillChoices[0].from.options
        .filter((o) => o.item?.index?.startsWith("skill-"))
        .map((o) => o.item.name.replace("Skill: ", ""))
        .join(", ")
    }`
  : undefined;
```

- [ ] **7C.3** Add a comment that `primaryAbility`, `subclassLabel`, `equipment`, `armorProfs`, `weaponProfs`, and `toolProfs` are MPMB-seeded via SQL migration 00018.

### Step 7D: Update Equipment Transformer

**File:** `scripts/transformers/equipment.ts`

- [ ] **7D.1** Import `sourceRefsSchema` from `mechanical.ts` (for type reference).

- [ ] **7D.2** Add `source_refs: [{ book: "SRD", page: 0 }]` to weapon data output in the weapon branch.

- [ ] **7D.3** Derive `monkweapon` flag from the API properties:

```typescript
const isMonkWeapon = (apiItem.properties ?? []).some((p) => p.index === "monk");
```

Note: The dnd5eapi does not tag monk weapons via properties. Set `monkweapon: false` as default; correct values are populated via SQL migration or manual correction. Add a comment noting this.

- [ ] **7D.4** Add a comment that `ability`, `ammo`, and `baseWeapon` are not available from the API and are either MPMB-seeded or set via homebrew creation.

---

## Step 8: Tests and Verification

- [ ] **8.1** **Schema backward compatibility tests:** Parse existing SRD content data through the expanded Zod schemas to confirm all existing data passes validation without the new optional fields:
  - `featDataSchema.parse(existingFeatData)` — must pass for SRD Grappler
  - `backgroundDataSchema.parse(existingBackgroundData)` — must pass for SRD Acolyte
  - `classDataSchema.parse(existingClassData)` — must pass for all 12 SRD classes
  - `featureDataSchema.parse(existingFeatureData)` — must pass for all existing features
  - `weaponDataSchema.parse(existingWeaponData)` — must pass for all existing weapons

- [ ] **8.2** **New field validation tests:** Write unit tests that construct objects with the new fields and validate:
  - Feat with scores, speed, spellcastingBonus (Magic Initiate-style homebrew feat)
  - Feat with calcChanges and addMod entries
  - Background with skills, languageProfs (choose 2), toolProfs, gold, equipment
  - Class with primaryAbility, subclassLabel, armorProfs (primary + secondary), weaponProfs
  - Feature with calcChanges, choices, extrachoices, weaponOptions
  - Feature with prereqeval and carryingCapacity
  - Weapon with ability, monkweapon, ammo, baseWeapon

- [ ] **8.3** **SQL migration dry run:** Run all three migrations (00016, 00017, 00018) against a fresh dev database seeded with `import-srd.ts`. Query results to validate:
  - Grappler feat has savetxt and source_refs
  - Acolyte background has skills=["insight","religion"] and languageProfs
  - All 12 classes have primaryAbility, subclassLabel, and armorProfs/weaponProfs
  - Barbarian subclassLabel = "Primal Path"

- [ ] **8.4** **Transformer regression test:** Run `npx tsx scripts/import-srd.ts` in dry-run mode after schema changes to confirm no regressions in the import pipeline. All content should still parse and upsert cleanly.

- [ ] **8.5** **TypeScript compilation:** `npx tsc --noEmit` clean across the entire project.

- [ ] **8.6** **Lint pass:** `npx next lint` clean.

---

## File Change Summary

| File | Change Type | Description |
|---|---|---|
| `lib/schemas/content-types/mechanical.ts` | EDIT | Add languageProfsSchema, toolProfsSchema, skillProfsSchema, calcChangesSchema, addModSchema, equipmentDescSchema |
| `lib/schemas/content-types/feat.ts` | EDIT | Add 20+ mechanical fields: scores, action, usages, speed, vision, proficiencies, spellcasting, calcChanges |
| `lib/schemas/content-types/background.ts` | EDIT | Add skills, gold, languageProfs, toolProfs, equipment, variant, source_refs |
| `lib/schemas/content-types/class.ts` | EDIT | Add primaryAbility, skillstxt, subclassLabel, equipment, armorProfs, weaponProfs, toolProfs |
| `lib/schemas/content-types/feature.ts` | EDIT | Add calcChanges, addMod, languageProfs, carryingCapacity, prereqeval, choices, extrachoices, weaponOptions, armorOptions |
| `lib/schemas/content-types/weapon.ts` | EDIT | Add ability, monkweapon, ammo, baseWeapon, source_refs |
| `lib/types/taxonomies.ts` | EDIT (maybe) | Extend WEAPON_CATEGORIES with Natural, Cantrip, Spell, Improvised if not already present |
| `scripts/transformers/feats.ts` | EDIT | Add source_refs to output |
| `scripts/transformers/backgrounds.ts` | EDIT | Extract skills, toolProfs, languageProfs from API data; add source_refs |
| `scripts/transformers/classes.ts` | EDIT | Derive skillstxt from proficiency choices; add source_refs |
| `scripts/transformers/equipment.ts` | EDIT | Add source_refs and monkweapon to weapon output |
| `supabase/migrations/00016_phase3_feat_enrichment.sql` | NEW | Enrich SRD Grappler feat with mechanical data |
| `supabase/migrations/00017_phase3_background_enrichment.sql` | NEW | Enrich SRD backgrounds with proficiency data |
| `supabase/migrations/00018_phase3_class_enrichment.sql` | NEW | Add primaryAbility, subclassLabel, equipment, proficiency structure to 12 SRD classes |

---

## Dependency Graph

```
Step 0 (shared sub-schemas in mechanical.ts)
  |
  +---> Step 1 (feat schema expansion)
  |       |
  |       +---> Step 6A (feat SQL migration)
  |       +---> Step 7A (feat transformer)
  |
  +---> Step 2 (background schema expansion)
  |       |
  |       +---> Step 6B (background SQL migration)
  |       +---> Step 7B (background transformer)
  |
  +---> Step 3 (class schema expansion)
  |       |
  |       +---> Step 6C (class SQL migration)
  |       +---> Step 7C (class transformer)
  |
  +---> Step 4 (feature schema expansion)
  |
  +---> Step 5 (weapon schema expansion)
          |
          +---> Step 7D (equipment transformer)

All steps ---> Step 8 (tests & verification)
```

**Parallelization:** Steps 1-5 can all run in parallel after Step 0. Steps 6A/6B/6C can run in parallel after their respective schema steps. Steps 7A-7D can run in parallel after their respective schema steps. Step 8 is last.

---

## MPMB Data Sourcing Notes

The SQL migrations (Step 6) require fetching exact values from MPMB. The agent implementing those steps MUST:

1. Fetch `ListsFeats.js` from `https://raw.githubusercontent.com/morepurplemorebetter/MPMBs-Character-Record-Sheet/master/additional%20content/ListsFeats.js`
2. Fetch `ListsBackgrounds.js` from the same repository
3. Fetch `ListsClasses.js` from the same repository (already used in Phase 1+2)
4. Extract mechanical effect fields for the Grappler feat
5. Extract proficiency data for SRD backgrounds (Acolyte primarily)
6. Extract primaryAbility, subclassLabel, equipment, and proficiency structure for all 12 SRD classes
7. Cross-reference against the existing `content_definitions` slugs to ensure the `WHERE` clauses match

If the MPMB files are unavailable, fall back to the D&D 5e SRD PDF and PHB tables for manual extraction.

---

## What This Phase Does NOT Cover

These are explicitly out of scope:

- **Companion/creature system** — creaturesAdd, companionCallback (deferred to dedicated creature management sub-project)
- **Equipment packs** — pack definitions with contents (Phase 4 / gear management)
- **General gear schema** — adventuring gear model beyond weapons/armor (Phase 4)
- **Ammunition schema** — full ammo model with quantity tracking (Phase 4)
- **UI for homebrew creation** — form builders for these new fields (separate sub-project)
- **Expression engine integration** — wiring calcChanges/addMod into the evaluator (separate sub-project)
- **Race height/weight** — descriptive fields deferred to Phase 4
- **Lifestyle level** for backgrounds — deferred to Phase 4
