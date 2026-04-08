# D&D 5e 2014 SRD Content Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the type system with choice effects and content-type schemas, then import all D&D 5e 2014 SRD content from dnd5eapi.co into `content_definitions`.

**Architecture:** Add a `choice` effect type to the existing effects system. Define Zod schemas per content type to validate the `data` JSONB column. Write a fetch-transform-load import script with per-content-type transformers that pull from the REST API, convert to our format, and upsert into Supabase.

**Tech Stack:** TypeScript, Zod, dnd5eapi.co REST API, Supabase client, Vitest

**Spec:** `docs/superpowers/specs/2026-04-07-dnd-5e-2014-srd-content-design.md`

---

## File Map

### Types & Taxonomies (modify/create)
- `lib/types/effects.ts` — Add `ChoiceEffect` to Effect union
- `lib/types/taxonomies.ts` — New: damage types, magic schools, creature sizes, weapon/armor categories, weapon properties, proficiency types

### Schemas (modify/create)
- `lib/schemas/effects.ts` — Add `choiceEffectSchema` to effectSchema union
- `lib/schemas/content-types/race.ts` — raceDataSchema
- `lib/schemas/content-types/subrace.ts` — subraceDataSchema
- `lib/schemas/content-types/class.ts` — classDataSchema
- `lib/schemas/content-types/subclass.ts` — subclassDataSchema
- `lib/schemas/content-types/background.ts` — backgroundDataSchema
- `lib/schemas/content-types/feat.ts` — featDataSchema
- `lib/schemas/content-types/spell.ts` — spellDataSchema
- `lib/schemas/content-types/weapon.ts` — weaponDataSchema
- `lib/schemas/content-types/armor.ts` — armorDataSchema
- `lib/schemas/content-types/item.ts` — itemDataSchema
- `lib/schemas/content-types/magic-item.ts` — magicItemDataSchema
- `lib/schemas/content-types/trait.ts` — traitDataSchema
- `lib/schemas/content-types/feature.ts` — featureDataSchema
- `lib/schemas/content-types/language.ts` — languageDataSchema
- `lib/schemas/content-types/proficiency.ts` — proficiencyDataSchema
- `lib/schemas/content-types/index.ts` — Schema registry mapping content_type → Zod schema

### Import Script
- `scripts/transformers/common.ts` — Shared API fetcher, slug utils, effect builder helpers
- `scripts/transformers/traits.ts` — Trait transformer
- `scripts/transformers/languages.ts` — Language transformer
- `scripts/transformers/proficiencies.ts` — Proficiency transformer
- `scripts/transformers/races.ts` — Race + subrace transformer
- `scripts/transformers/features.ts` — Feature transformer
- `scripts/transformers/classes.ts` — Class + subclass transformer
- `scripts/transformers/backgrounds.ts` — Background transformer
- `scripts/transformers/feats.ts` — Feat transformer
- `scripts/transformers/spells.ts` — Spell transformer
- `scripts/transformers/equipment.ts` — Weapon, armor, general item transformer
- `scripts/transformers/magic-items.ts` — Magic item transformer
- `scripts/import-srd.ts` — Main orchestrator

### Tests
- `tests/schemas/content-types.test.ts` — All content-type schema validation
- `tests/transformers/common.test.ts` — Effect builder helpers
- `tests/transformers/races.test.ts` — Race transformer
- `tests/transformers/spells.test.ts` — Spell transformer
- `tests/transformers/classes.test.ts` — Class transformer
- `tests/transformers/equipment.test.ts` — Equipment transformer

### Config
- `.gitignore` — Add `data/srd-2014/raw/`

---

## Task 1: Add Choice Effect Type

**Files:**
- Modify: `lib/types/effects.ts`
- Modify: `lib/schemas/effects.ts`
- Modify: `tests/schemas/effects.test.ts`

- [ ] **Step 1: Write failing tests for choice effect**

Add to `tests/schemas/effects.test.ts`:

```typescript
describe("choiceEffectSchema", () => {
  it("validates a choice with explicit list", () => {
    const result = effectSchema.safeParse({
      type: "choice",
      choose: 2,
      from: ["athletics", "acrobatics", "history"],
      grant_type: "skill_proficiency",
      choice_id: "fighter-skill-choice",
    });
    expect(result.success).toBe(true);
  });

  it("validates a choice with category string", () => {
    const result = effectSchema.safeParse({
      type: "choice",
      choose: 1,
      from: "all_languages",
      grant_type: "language",
      choice_id: "elf-language-choice",
    });
    expect(result.success).toBe(true);
  });

  it("rejects choice with choose < 1", () => {
    const result = effectSchema.safeParse({
      type: "choice",
      choose: 0,
      from: ["athletics"],
      grant_type: "skill_proficiency",
      choice_id: "bad-choice",
    });
    expect(result.success).toBe(false);
  });

  it("rejects choice without choice_id", () => {
    const result = effectSchema.safeParse({
      type: "choice",
      choose: 1,
      from: ["athletics"],
      grant_type: "skill_proficiency",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/schemas/effects.test.ts
```

Expected: FAIL — "choice" is not a valid discriminator value

- [ ] **Step 3: Add ChoiceEffect to types**

Add to `lib/types/effects.ts` before the `Effect` union:

```typescript
export interface ChoiceEffect {
  type: "choice";
  choose: number;
  from: string[] | string;
  grant_type: string;
  choice_id: string;
}
```

Update the `Effect` union:

```typescript
export type Effect = MechanicalEffect | NarrativeEffect | GrantEffect | ChoiceEffect;
```

- [ ] **Step 4: Add choiceEffectSchema to schemas**

Add to `lib/schemas/effects.ts` before the `effectSchema` union:

```typescript
export const choiceEffectSchema = z.object({
  type: z.literal("choice"),
  choose: z.number().int().min(1),
  from: z.union([z.array(z.string().min(1)).min(1), z.string().min(1)]),
  grant_type: z.string().min(1),
  choice_id: z.string().min(1),
});
```

Update the `effectSchema` discriminated union to include it:

```typescript
export const effectSchema = z.discriminatedUnion("type", [
  mechanicalEffectSchema,
  narrativeEffectSchema,
  grantEffectSchema,
  choiceEffectSchema,
]);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/schemas/effects.test.ts
```

Expected: All tests PASS (existing + 4 new)

- [ ] **Step 6: Commit**

```bash
git add lib/types/effects.ts lib/schemas/effects.ts tests/schemas/effects.test.ts
git commit -m "feat: add choice effect type for character creation selections"
```

---

## Task 2: Taxonomy Constants

**Files:**
- Create: `lib/types/taxonomies.ts`

- [ ] **Step 1: Create taxonomies file**

Create `lib/types/taxonomies.ts`:

```typescript
export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning",
  "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const MAGIC_SCHOOLS = [
  "abjuration", "conjuration", "divination", "enchantment",
  "evocation", "illusion", "necromancy", "transmutation",
] as const;
export type MagicSchool = (typeof MAGIC_SCHOOLS)[number];

export const CREATURE_SIZES = [
  "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan",
] as const;
export type CreatureSize = (typeof CREATURE_SIZES)[number];

export const ARMOR_CATEGORIES = ["Light", "Medium", "Heavy", "Shield"] as const;
export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number];

export const WEAPON_CATEGORIES = ["Simple", "Martial"] as const;
export type WeaponCategory = (typeof WEAPON_CATEGORIES)[number];

export const WEAPON_RANGE_TYPES = ["Melee", "Ranged"] as const;
export type WeaponRangeType = (typeof WEAPON_RANGE_TYPES)[number];

export const WEAPON_PROPERTIES = [
  "ammunition", "finesse", "heavy", "light", "loading",
  "range", "reach", "special", "thrown", "two-handed", "versatile",
] as const;
export type WeaponProperty = (typeof WEAPON_PROPERTIES)[number];

export const PROFICIENCY_TYPES = [
  "skill", "armor", "weapon", "tool", "saving_throw",
] as const;
export type ProficiencyType = (typeof PROFICIENCY_TYPES)[number];

export const ITEM_RARITIES = [
  "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact",
] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export const SPELLCASTING_TYPES = [
  "full", "half", "third", "pact",
] as const;
export type SpellcastingType = (typeof SPELLCASTING_TYPES)[number];
```

- [ ] **Step 2: Verify type check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/types/taxonomies.ts
git commit -m "feat: add taxonomy constants for damage types, magic schools, equipment categories"
```

---

## Task 3: Content-Type Zod Schemas — Core Types

**Files:**
- Create: `lib/schemas/content-types/race.ts`, `subrace.ts`, `trait.ts`, `language.ts`, `proficiency.ts`, `feature.ts`
- Create: `lib/schemas/content-types/index.ts`
- Test: `tests/schemas/content-types.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/schemas/content-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { subraceDataSchema } from "@/lib/schemas/content-types/subrace";
import { traitDataSchema } from "@/lib/schemas/content-types/trait";
import { languageDataSchema } from "@/lib/schemas/content-types/language";
import { proficiencyDataSchema } from "@/lib/schemas/content-types/proficiency";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { getContentTypeSchema } from "@/lib/schemas/content-types/index";

describe("Race Data Schema", () => {
  it("validates a complete race entry", () => {
    const result = raceDataSchema.safeParse({
      size: "Medium",
      speed: 30,
      age_description: "Elves reach maturity around 100",
      alignment_description: "Elves tend toward chaotic good",
      size_description: "Elves range from 5 to 6 feet",
      language_description: "You can speak Common and Elvish",
      traits: ["darkvision", "fey-ancestry"],
      subraces: ["high-elf"],
      languages: ["common", "elvish"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects race with invalid size", () => {
    const result = raceDataSchema.safeParse({
      size: "Enormous",
      speed: 30,
      traits: [],
      subraces: [],
      languages: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Subrace Data Schema", () => {
  it("validates a subrace entry", () => {
    const result = subraceDataSchema.safeParse({
      parent_race: "elf",
      description: "High elves have a keen mind",
      traits: ["elf-weapon-training"],
      languages: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Trait Data Schema", () => {
  it("validates a trait entry", () => {
    const result = traitDataSchema.safeParse({
      description: "You can see in dim light within 60 feet",
      races: ["elf", "dwarf"],
      subraces: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Language Data Schema", () => {
  it("validates a language entry", () => {
    const result = languageDataSchema.safeParse({
      type: "Standard",
      script: "Elvish",
      typical_speakers: ["Elves"],
      description: "The language of the elves",
    });
    expect(result.success).toBe(true);
  });
});

describe("Proficiency Data Schema", () => {
  it("validates a proficiency entry", () => {
    const result = proficiencyDataSchema.safeParse({
      proficiency_type: "skill",
      reference: "acrobatics",
      classes: ["rogue"],
      races: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Feature Data Schema", () => {
  it("validates a class feature entry", () => {
    const result = featureDataSchema.safeParse({
      class: "wizard",
      subclass: null,
      level: 2,
      description: "You learn to regain some magical energy",
    });
    expect(result.success).toBe(true);
  });

  it("validates a subclass feature", () => {
    const result = featureDataSchema.safeParse({
      class: "bard",
      subclass: "lore",
      level: 3,
      description: "You learn additional spells",
    });
    expect(result.success).toBe(true);
  });
});

describe("Schema Registry", () => {
  it("returns race schema for 'race' content type", () => {
    const schema = getContentTypeSchema("race");
    expect(schema).toBeDefined();
  });

  it("returns undefined for unknown content type", () => {
    const schema = getContentTypeSchema("unknown_type");
    expect(schema).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/schemas/content-types.test.ts
```

Expected: FAIL — cannot find modules

- [ ] **Step 3: Create race schema**

Create `lib/schemas/content-types/race.ts`:

```typescript
import { z } from "zod";
import { CREATURE_SIZES } from "@/lib/types/taxonomies";

export const raceDataSchema = z.object({
  size: z.enum(CREATURE_SIZES),
  speed: z.number().int().positive(),
  age_description: z.string().optional().default(""),
  alignment_description: z.string().optional().default(""),
  size_description: z.string().optional().default(""),
  language_description: z.string().optional().default(""),
  traits: z.array(z.string()).default([]),
  subraces: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
});

export type RaceData = z.infer<typeof raceDataSchema>;
```

- [ ] **Step 4: Create subrace schema**

Create `lib/schemas/content-types/subrace.ts`:

```typescript
import { z } from "zod";

export const subraceDataSchema = z.object({
  parent_race: z.string().min(1),
  description: z.string().default(""),
  traits: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
});

export type SubraceData = z.infer<typeof subraceDataSchema>;
```

- [ ] **Step 5: Create trait schema**

Create `lib/schemas/content-types/trait.ts`:

```typescript
import { z } from "zod";

export const traitDataSchema = z.object({
  description: z.string().min(1),
  races: z.array(z.string()).default([]),
  subraces: z.array(z.string()).default([]),
});

export type TraitData = z.infer<typeof traitDataSchema>;
```

- [ ] **Step 6: Create language schema**

Create `lib/schemas/content-types/language.ts`:

```typescript
import { z } from "zod";

export const languageDataSchema = z.object({
  type: z.enum(["Standard", "Exotic"]).default("Standard"),
  script: z.string().nullable().default(null),
  typical_speakers: z.array(z.string()).default([]),
  description: z.string().default(""),
});

export type LanguageData = z.infer<typeof languageDataSchema>;
```

- [ ] **Step 7: Create proficiency schema**

Create `lib/schemas/content-types/proficiency.ts`:

```typescript
import { z } from "zod";
import { PROFICIENCY_TYPES } from "@/lib/types/taxonomies";

export const proficiencyDataSchema = z.object({
  proficiency_type: z.enum(PROFICIENCY_TYPES),
  reference: z.string().default(""),
  classes: z.array(z.string()).default([]),
  races: z.array(z.string()).default([]),
});

export type ProficiencyData = z.infer<typeof proficiencyDataSchema>;
```

- [ ] **Step 8: Create feature schema**

Create `lib/schemas/content-types/feature.ts`:

```typescript
import { z } from "zod";

export const featureDataSchema = z.object({
  class: z.string().min(1),
  subclass: z.string().nullable().default(null),
  level: z.number().int().min(1).max(20),
  description: z.string().min(1),
});

export type FeatureData = z.infer<typeof featureDataSchema>;
```

- [ ] **Step 9: Create schema registry (partial — more schemas added in next tasks)**

Create `lib/schemas/content-types/index.ts`:

```typescript
import type { z } from "zod";
import { raceDataSchema } from "./race";
import { subraceDataSchema } from "./subrace";
import { traitDataSchema } from "./trait";
import { languageDataSchema } from "./language";
import { proficiencyDataSchema } from "./proficiency";
import { featureDataSchema } from "./feature";

const CONTENT_TYPE_SCHEMAS: Record<string, z.ZodType> = {
  race: raceDataSchema,
  subrace: subraceDataSchema,
  trait: traitDataSchema,
  language: languageDataSchema,
  proficiency: proficiencyDataSchema,
  feature: featureDataSchema,
};

export function getContentTypeSchema(contentType: string): z.ZodType | undefined {
  return CONTENT_TYPE_SCHEMAS[contentType];
}

export function registerContentTypeSchema(contentType: string, schema: z.ZodType): void {
  CONTENT_TYPE_SCHEMAS[contentType] = schema;
}
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
npx vitest run tests/schemas/content-types.test.ts
```

Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add lib/schemas/content-types/ tests/schemas/content-types.test.ts
git commit -m "feat: add Zod schemas for race, subrace, trait, language, proficiency, feature"
```

---

## Task 4: Content-Type Zod Schemas — Class & Background

**Files:**
- Create: `lib/schemas/content-types/class.ts`, `subclass.ts`, `background.ts`, `feat.ts`
- Modify: `lib/schemas/content-types/index.ts`
- Modify: `tests/schemas/content-types.test.ts`

- [ ] **Step 1: Add failing tests**

Add to `tests/schemas/content-types.test.ts`:

```typescript
import { classDataSchema } from "@/lib/schemas/content-types/class";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import { backgroundDataSchema } from "@/lib/schemas/content-types/background";
import { featDataSchema } from "@/lib/schemas/content-types/feat";

// Add these describe blocks:

describe("Class Data Schema", () => {
  it("validates a non-caster class", () => {
    const result = classDataSchema.safeParse({
      hit_die: 10,
      spellcasting: null,
      multiclass: {
        prerequisites: [{ stat: "strength", op: "gte", value: 13 }],
        proficiencies_gained: ["light-armor", "medium-armor"],
      },
      saving_throws: ["strength", "constitution"],
      starting_proficiencies: ["all-armor", "shields", "simple-weapons", "martial-weapons"],
      levels: [
        { level: 1, features: ["fighting-style", "second-wind"], spellcasting: null },
        { level: 2, features: ["action-surge"], spellcasting: null },
        { level: 3, features: [], spellcasting: null, subclass_level: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates a caster class with spell slots", () => {
    const result = classDataSchema.safeParse({
      hit_die: 6,
      spellcasting: {
        ability: "intelligence",
        type: "full",
        focus: "arcane focus",
        ritual_casting: true,
      },
      multiclass: {
        prerequisites: [{ stat: "intelligence", op: "gte", value: 13 }],
        proficiencies_gained: [],
      },
      saving_throws: ["intelligence", "wisdom"],
      starting_proficiencies: ["daggers", "darts", "slings", "quarterstaffs", "light-crossbows"],
      levels: [
        {
          level: 1,
          features: ["arcane-recovery"],
          spellcasting: { cantrips_known: 3, spell_slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("Subclass Data Schema", () => {
  it("validates a subclass entry", () => {
    const result = subclassDataSchema.safeParse({
      parent_class: "bard",
      flavor_label: "Bard College",
      description: "The College of Lore...",
      levels: [
        { level: 3, features: ["bonus-proficiencies", "cutting-words"] },
        { level: 6, features: ["additional-magical-secrets"] },
      ],
      spells: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Background Data Schema", () => {
  it("validates a background entry", () => {
    const result = backgroundDataSchema.safeParse({
      feature: {
        name: "Shelter of the Faithful",
        description: "As an acolyte, you command respect...",
      },
      personality_traits: ["I idolize a hero of my faith"],
      ideals: [{ text: "Tradition. The ancient traditions...", alignment: "Lawful" }],
      bonds: ["I would die to recover an ancient relic"],
      flaws: ["I judge others harshly"],
    });
    expect(result.success).toBe(true);
  });
});

describe("Feat Data Schema", () => {
  it("validates a feat with prerequisites", () => {
    const result = featDataSchema.safeParse({
      description: "You have practiced grappling techniques...",
      prerequisites: [{ stat: "strength", op: "gte", value: 13 }],
    });
    expect(result.success).toBe(true);
  });

  it("validates a feat without prerequisites", () => {
    const result = featDataSchema.safeParse({
      description: "You gain proficiency with three tools...",
      prerequisites: [],
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/schemas/content-types.test.ts
```

- [ ] **Step 3: Create class schema**

Create `lib/schemas/content-types/class.ts`:

```typescript
import { z } from "zod";
import { statConditionSchema } from "@/lib/schemas/effects";
import { SPELLCASTING_TYPES } from "@/lib/types/taxonomies";

const spellcastingConfigSchema = z.object({
  ability: z.string().min(1),
  type: z.enum(SPELLCASTING_TYPES),
  focus: z.string().default(""),
  ritual_casting: z.boolean().default(false),
});

const levelSpellcastingSchema = z.object({
  cantrips_known: z.number().int().min(0).optional(),
  spell_slots: z.array(z.number().int().min(0)).length(9),
});

const classLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(z.string()),
  spellcasting: levelSpellcastingSchema.nullable().default(null),
  subclass_level: z.boolean().optional(),
  class_specific: z.record(z.string(), z.unknown()).optional(),
});

const multiclassSchema = z.object({
  prerequisites: z.array(statConditionSchema),
  proficiencies_gained: z.array(z.string()),
});

export const classDataSchema = z.object({
  hit_die: z.number().int().positive(),
  spellcasting: spellcastingConfigSchema.nullable(),
  multiclass: multiclassSchema,
  saving_throws: z.array(z.string()),
  starting_proficiencies: z.array(z.string()),
  levels: z.array(classLevelSchema).min(1),
});

export type ClassData = z.infer<typeof classDataSchema>;
```

- [ ] **Step 4: Create subclass schema**

Create `lib/schemas/content-types/subclass.ts`:

```typescript
import { z } from "zod";

const subclassLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(z.string()),
});

export const subclassDataSchema = z.object({
  parent_class: z.string().min(1),
  flavor_label: z.string().default(""),
  description: z.string().default(""),
  levels: z.array(subclassLevelSchema).min(1),
  spells: z.array(z.string()).default([]),
});

export type SubclassData = z.infer<typeof subclassDataSchema>;
```

- [ ] **Step 5: Create background schema**

Create `lib/schemas/content-types/background.ts`:

```typescript
import { z } from "zod";

const idealSchema = z.object({
  text: z.string().min(1),
  alignment: z.string().default(""),
});

export const backgroundDataSchema = z.object({
  feature: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
  personality_traits: z.array(z.string()).default([]),
  ideals: z.array(idealSchema).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
});

export type BackgroundData = z.infer<typeof backgroundDataSchema>;
```

- [ ] **Step 6: Create feat schema**

Create `lib/schemas/content-types/feat.ts`:

```typescript
import { z } from "zod";
import { statConditionSchema } from "@/lib/schemas/effects";

export const featDataSchema = z.object({
  description: z.string().min(1),
  prerequisites: z.array(statConditionSchema).default([]),
});

export type FeatData = z.infer<typeof featDataSchema>;
```

- [ ] **Step 7: Update schema registry**

Add imports and entries to `lib/schemas/content-types/index.ts`:

```typescript
import { classDataSchema } from "./class";
import { subclassDataSchema } from "./subclass";
import { backgroundDataSchema } from "./background";
import { featDataSchema } from "./feat";
```

Add to `CONTENT_TYPE_SCHEMAS`:

```typescript
  class: classDataSchema,
  subclass: subclassDataSchema,
  background: backgroundDataSchema,
  feat: featDataSchema,
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run tests/schemas/content-types.test.ts
```

Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add lib/schemas/content-types/ tests/schemas/content-types.test.ts
git commit -m "feat: add Zod schemas for class, subclass, background, feat"
```

---

## Task 5: Content-Type Zod Schemas — Spell & Equipment

**Files:**
- Create: `lib/schemas/content-types/spell.ts`, `weapon.ts`, `armor.ts`, `item.ts`, `magic-item.ts`
- Modify: `lib/schemas/content-types/index.ts`
- Modify: `tests/schemas/content-types.test.ts`

- [ ] **Step 1: Add failing tests**

Add to `tests/schemas/content-types.test.ts`:

```typescript
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import { weaponDataSchema } from "@/lib/schemas/content-types/weapon";
import { armorDataSchema } from "@/lib/schemas/content-types/armor";
import { itemDataSchema } from "@/lib/schemas/content-types/item";
import { magicItemDataSchema } from "@/lib/schemas/content-types/magic-item";

describe("Spell Data Schema", () => {
  it("validates a damage spell (Fireball)", () => {
    const result = spellDataSchema.safeParse({
      level: 3,
      school: "evocation",
      casting_time: "1 action",
      range: "150 feet",
      components: ["V", "S", "M"],
      material: "A tiny ball of bat guano and sulfur",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      description: "A bright streak flashes from your pointing finger...",
      higher_level: "When you cast this spell using a spell slot of 4th level or higher...",
      damage: {
        type: "fire",
        dice_at_slot_level: { "3": "8d6", "4": "9d6", "5": "10d6" },
      },
      heal_at_slot_level: null,
      dc: { type: "dexterity", success: "half" },
      area_of_effect: { type: "sphere", size: 20 },
      classes: ["sorcerer", "wizard"],
      subclasses: ["fiend"],
    });
    expect(result.success).toBe(true);
  });

  it("validates a cantrip", () => {
    const result = spellDataSchema.safeParse({
      level: 0,
      school: "evocation",
      casting_time: "1 action",
      range: "120 feet",
      components: ["V", "S"],
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      description: "A beam of crackling energy streaks...",
      damage: { type: "force", dice_at_slot_level: { "0": "1d10" } },
      dc: null,
      area_of_effect: null,
      classes: ["sorcerer", "wizard"],
      subclasses: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Weapon Data Schema", () => {
  it("validates a melee weapon", () => {
    const result = weaponDataSchema.safeParse({
      weapon_category: "Martial",
      weapon_range: "Melee",
      cost: { quantity: 15, unit: "gp" },
      weight: 3,
      damage: { dice: "1d8", type: "slashing" },
      range: null,
      properties: ["versatile"],
      two_handed_damage: { dice: "1d10", type: "slashing" },
    });
    expect(result.success).toBe(true);
  });
});

describe("Armor Data Schema", () => {
  it("validates heavy armor", () => {
    const result = armorDataSchema.safeParse({
      armor_category: "Heavy",
      cost: { quantity: 75, unit: "gp" },
      weight: 65,
      armor_class: { base: 16, dex_bonus: false, max_bonus: null },
      str_minimum: 13,
      stealth_disadvantage: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("Item Data Schema", () => {
  it("validates general equipment", () => {
    const result = itemDataSchema.safeParse({
      equipment_category: "Adventuring Gear",
      cost: { quantity: 5, unit: "gp" },
      weight: 1,
      description: "A backpack can hold up to...",
    });
    expect(result.success).toBe(true);
  });
});

describe("Magic Item Data Schema", () => {
  it("validates a magic item", () => {
    const result = magicItemDataSchema.safeParse({
      rarity: "Uncommon",
      description: "Any critical hit against you becomes a normal hit",
      equipment_category: "Armor",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/schemas/content-types.test.ts
```

- [ ] **Step 3: Create spell schema**

Create `lib/schemas/content-types/spell.ts`:

```typescript
import { z } from "zod";
import { MAGIC_SCHOOLS, DAMAGE_TYPES } from "@/lib/types/taxonomies";

const spellDamageSchema = z.object({
  type: z.enum(DAMAGE_TYPES),
  dice_at_slot_level: z.record(z.string(), z.string()),
});

const spellDcSchema = z.object({
  type: z.string().min(1),
  success: z.enum(["half", "none", "other"]),
});

const areaOfEffectSchema = z.object({
  type: z.enum(["sphere", "cone", "cylinder", "line", "cube"]),
  size: z.number().positive(),
});

export const spellDataSchema = z.object({
  level: z.number().int().min(0).max(9),
  school: z.enum(MAGIC_SCHOOLS),
  casting_time: z.string().min(1),
  range: z.string().min(1),
  components: z.array(z.enum(["V", "S", "M"])),
  material: z.string().optional(),
  duration: z.string().min(1),
  concentration: z.boolean(),
  ritual: z.boolean(),
  description: z.string().min(1),
  higher_level: z.string().optional(),
  damage: spellDamageSchema.nullable().default(null),
  heal_at_slot_level: z.record(z.string(), z.string()).nullable().optional().default(null),
  dc: spellDcSchema.nullable().default(null),
  area_of_effect: areaOfEffectSchema.nullable().default(null),
  classes: z.array(z.string()).default([]),
  subclasses: z.array(z.string()).default([]),
});

export type SpellData = z.infer<typeof spellDataSchema>;
```

- [ ] **Step 4: Create weapon schema**

Create `lib/schemas/content-types/weapon.ts`:

```typescript
import { z } from "zod";
import { WEAPON_CATEGORIES, WEAPON_RANGE_TYPES, DAMAGE_TYPES } from "@/lib/types/taxonomies";

const costSchema = z.object({
  quantity: z.number().min(0),
  unit: z.string().min(1),
});

const weaponDamageSchema = z.object({
  dice: z.string().min(1),
  type: z.enum(DAMAGE_TYPES),
});

const rangeSchema = z.object({
  normal: z.number().positive(),
  long: z.number().positive().optional(),
});

export const weaponDataSchema = z.object({
  weapon_category: z.enum(WEAPON_CATEGORIES),
  weapon_range: z.enum(WEAPON_RANGE_TYPES),
  cost: costSchema.nullable().default(null),
  weight: z.number().min(0).nullable().default(null),
  damage: weaponDamageSchema.nullable().default(null),
  range: rangeSchema.nullable().default(null),
  properties: z.array(z.string()).default([]),
  two_handed_damage: weaponDamageSchema.nullable().default(null),
});

export type WeaponData = z.infer<typeof weaponDataSchema>;
```

- [ ] **Step 5: Create armor schema**

Create `lib/schemas/content-types/armor.ts`:

```typescript
import { z } from "zod";
import { ARMOR_CATEGORIES } from "@/lib/types/taxonomies";

const costSchema = z.object({
  quantity: z.number().min(0),
  unit: z.string().min(1),
});

const armorClassSchema = z.object({
  base: z.number().int(),
  dex_bonus: z.boolean(),
  max_bonus: z.number().int().nullable().default(null),
});

export const armorDataSchema = z.object({
  armor_category: z.enum(ARMOR_CATEGORIES),
  cost: costSchema.nullable().default(null),
  weight: z.number().min(0).nullable().default(null),
  armor_class: armorClassSchema,
  str_minimum: z.number().int().min(0).default(0),
  stealth_disadvantage: z.boolean().default(false),
});

export type ArmorData = z.infer<typeof armorDataSchema>;
```

- [ ] **Step 6: Create item schema**

Create `lib/schemas/content-types/item.ts`:

```typescript
import { z } from "zod";

const costSchema = z.object({
  quantity: z.number().min(0),
  unit: z.string().min(1),
});

export const itemDataSchema = z.object({
  equipment_category: z.string().default(""),
  cost: costSchema.nullable().default(null),
  weight: z.number().min(0).nullable().default(null),
  description: z.string().default(""),
});

export type ItemData = z.infer<typeof itemDataSchema>;
```

- [ ] **Step 7: Create magic item schema**

Create `lib/schemas/content-types/magic-item.ts`:

```typescript
import { z } from "zod";
import { ITEM_RARITIES } from "@/lib/types/taxonomies";

export const magicItemDataSchema = z.object({
  rarity: z.enum(ITEM_RARITIES).default("Common"),
  description: z.string().default(""),
  equipment_category: z.string().optional(),
});

export type MagicItemData = z.infer<typeof magicItemDataSchema>;
```

- [ ] **Step 8: Update schema registry**

Add imports and entries to `lib/schemas/content-types/index.ts`:

```typescript
import { spellDataSchema } from "./spell";
import { weaponDataSchema } from "./weapon";
import { armorDataSchema } from "./armor";
import { itemDataSchema } from "./item";
import { magicItemDataSchema } from "./magic-item";
```

Add to `CONTENT_TYPE_SCHEMAS`:

```typescript
  spell: spellDataSchema,
  weapon: weaponDataSchema,
  armor: armorDataSchema,
  item: itemDataSchema,
  magic_item: magicItemDataSchema,
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
npx vitest run tests/schemas/content-types.test.ts
```

Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add lib/schemas/content-types/ tests/schemas/content-types.test.ts
git commit -m "feat: add Zod schemas for spell, weapon, armor, item, magic item"
```

---

## Task 6: Transformer Utilities & Effect Builders

**Files:**
- Create: `scripts/transformers/common.ts`
- Test: `tests/transformers/common.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/transformers/common.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildMechanicalEffect,
  buildGrantEffect,
  buildNarrativeEffect,
  buildChoiceEffect,
  buildAbilityBonusEffects,
  normalizeSlug,
} from "@/scripts/transformers/common";

describe("normalizeSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(normalizeSlug("Sleight of Hand")).toBe("sleight-of-hand");
  });

  it("handles already normalized slugs", () => {
    expect(normalizeSlug("athletics")).toBe("athletics");
  });
});

describe("buildMechanicalEffect", () => {
  it("builds an add effect", () => {
    const effect = buildMechanicalEffect("dexterity", "add", 2);
    expect(effect).toEqual({
      type: "mechanical",
      stat: "dexterity",
      op: "add",
      value: 2,
    });
  });
});

describe("buildGrantEffect", () => {
  it("builds a grant effect", () => {
    const effect = buildGrantEffect("perception", "proficient");
    expect(effect).toEqual({
      type: "grant",
      stat: "perception",
      value: "proficient",
    });
  });
});

describe("buildNarrativeEffect", () => {
  it("builds a narrative effect with tag", () => {
    const effect = buildNarrativeEffect("You have darkvision 60ft", "Racial Trait");
    expect(effect).toEqual({
      type: "narrative",
      text: "You have darkvision 60ft",
      tag: "Racial Trait",
    });
  });
});

describe("buildChoiceEffect", () => {
  it("builds a choice effect", () => {
    const effect = buildChoiceEffect(2, ["athletics", "acrobatics"], "skill_proficiency", "fighter-skills");
    expect(effect).toEqual({
      type: "choice",
      choose: 2,
      from: ["athletics", "acrobatics"],
      grant_type: "skill_proficiency",
      choice_id: "fighter-skills",
    });
  });
});

describe("buildAbilityBonusEffects", () => {
  it("converts API ability bonuses to effects", () => {
    const apiBonuses = [
      { ability_score: { index: "dex", name: "DEX" }, bonus: 2 },
      { ability_score: { index: "wis", name: "WIS" }, bonus: 1 },
    ];
    const effects = buildAbilityBonusEffects(apiBonuses);
    expect(effects).toHaveLength(2);
    expect(effects[0]).toEqual({
      type: "mechanical",
      stat: "dexterity",
      op: "add",
      value: 2,
    });
    expect(effects[1]).toEqual({
      type: "mechanical",
      stat: "wisdom",
      op: "add",
      value: 1,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/transformers/common.test.ts
```

- [ ] **Step 3: Implement common utilities**

Create `scripts/transformers/common.ts`:

```typescript
import type { MechanicalEffect, GrantEffect, NarrativeEffect, ChoiceEffect, Effect } from "@/lib/types/effects";

const API_BASE = "https://www.dnd5eapi.co/api/2014";

// --- API Fetch ---

export async function fetchFromApi<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API fetch failed: ${response.status} ${url}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAllFromApi<T>(path: string): Promise<T[]> {
  const listResponse = await fetchFromApi<{ results: Array<{ index: string; url: string }> }>(path);
  const items: T[] = [];
  for (const result of listResponse.results) {
    const item = await fetchFromApi<T>(result.url);
    items.push(item);
  }
  return items;
}

// --- Slug Normalization ---

const ABILITY_ABBREVIATIONS: Record<string, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

export function normalizeSlug(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function expandAbilityAbbreviation(abbr: string): string {
  return ABILITY_ABBREVIATIONS[abbr.toLowerCase()] ?? abbr.toLowerCase();
}

// --- Effect Builders ---

export function buildMechanicalEffect(
  stat: string,
  op: "add" | "set" | "multiply" | "max" | "min",
  value: number | string
): MechanicalEffect {
  return { type: "mechanical", stat, op, value };
}

export function buildGrantEffect(stat: string, value: string): GrantEffect {
  return { type: "grant", stat, value };
}

export function buildNarrativeEffect(text: string, tag?: string): NarrativeEffect {
  return { type: "narrative", text, ...(tag ? { tag } : {}) };
}

export function buildChoiceEffect(
  choose: number,
  from: string[] | string,
  grantType: string,
  choiceId: string
): ChoiceEffect {
  return { type: "choice", choose, from, grant_type: grantType, choice_id: choiceId };
}

interface ApiAbilityBonus {
  ability_score: { index: string; name: string };
  bonus: number;
}

export function buildAbilityBonusEffects(bonuses: ApiAbilityBonus[]): MechanicalEffect[] {
  return bonuses.map((b) => ({
    type: "mechanical" as const,
    stat: expandAbilityAbbreviation(b.ability_score.index),
    op: "add" as const,
    value: b.bonus,
  }));
}

// --- Content Definition Builder ---

export interface TransformedContent {
  content_type: string;
  slug: string;
  name: string;
  data: Record<string, unknown>;
  effects: Effect[];
}

export function buildContentEntry(
  contentType: string,
  slug: string,
  name: string,
  data: Record<string, unknown>,
  effects: Effect[] = []
): TransformedContent {
  return { content_type: contentType, slug, name, data, effects };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/transformers/common.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/transformers/common.ts tests/transformers/common.test.ts
git commit -m "feat: add transformer utilities — API fetch, slug normalization, effect builders"
```

---

## Task 7: Trait, Language & Proficiency Transformers

**Files:**
- Create: `scripts/transformers/traits.ts`, `scripts/transformers/languages.ts`, `scripts/transformers/proficiencies.ts`

These are the simplest transformers and are imported first (no dependencies on other content).

- [ ] **Step 1: Create traits transformer**

Create `scripts/transformers/traits.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";

interface ApiTrait {
  index: string;
  name: string;
  desc: string[];
  races: Array<{ index: string; name: string }>;
  subraces: Array<{ index: string; name: string }>;
  proficiencies: Array<{ index: string; name: string }>;
  proficiency_choices?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
}

export async function transformTraits(): Promise<TransformedContent[]> {
  const traits = await fetchAllFromApi<ApiTrait>("/traits");
  return traits.map((trait) => {
    const effects = [];

    // Proficiency grants
    for (const prof of trait.proficiencies) {
      effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
    }

    // Proficiency choices
    if (trait.proficiency_choices) {
      const options = trait.proficiency_choices.from.options.map((o) => normalizeSlug(o.item.index));
      effects.push(buildChoiceEffect(
        trait.proficiency_choices.choose,
        options,
        "proficiency",
        `${trait.index}-proficiency-choice`
      ));
    }

    // Description as narrative
    if (trait.desc.length > 0) {
      effects.push(buildNarrativeEffect(trait.desc.join("\n"), "Racial Trait"));
    }

    return buildContentEntry("trait", trait.index, trait.name, {
      description: trait.desc.join("\n"),
      races: trait.races.map((r) => r.index),
      subraces: trait.subraces.map((r) => r.index),
    }, effects);
  });
}
```

- [ ] **Step 2: Create languages transformer**

Create `scripts/transformers/languages.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry } from "./common";
import type { TransformedContent } from "./common";

interface ApiLanguage {
  index: string;
  name: string;
  desc: string;
  type: string;
  script: string | null;
  typical_speakers: string[];
}

export async function transformLanguages(): Promise<TransformedContent[]> {
  const languages = await fetchAllFromApi<ApiLanguage>("/languages");
  return languages.map((lang) =>
    buildContentEntry("language", lang.index, lang.name, {
      type: lang.type,
      script: lang.script ?? null,
      typical_speakers: lang.typical_speakers,
      description: lang.desc ?? "",
    })
  );
}
```

- [ ] **Step 3: Create proficiencies transformer**

Create `scripts/transformers/proficiencies.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry } from "./common";
import type { TransformedContent } from "./common";

interface ApiProficiency {
  index: string;
  name: string;
  type: string;
  classes: Array<{ index: string }>;
  races: Array<{ index: string }>;
}

function mapProficiencyType(apiType: string): string {
  const mapping: Record<string, string> = {
    "Skills": "skill",
    "Armor": "armor",
    "Weapons": "weapon",
    "Artisan's Tools": "tool",
    "Gaming Sets": "tool",
    "Musical Instruments": "tool",
    "Other": "tool",
    "Saving Throws": "saving_throw",
    "Vehicles": "tool",
  };
  return mapping[apiType] ?? "tool";
}

export async function transformProficiencies(): Promise<TransformedContent[]> {
  const proficiencies = await fetchAllFromApi<ApiProficiency>("/proficiencies");
  return proficiencies.map((prof) =>
    buildContentEntry("proficiency", prof.index, prof.name, {
      proficiency_type: mapProficiencyType(prof.type),
      reference: prof.index,
      classes: prof.classes.map((c) => c.index),
      races: prof.races.map((r) => r.index),
    })
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/transformers/traits.ts scripts/transformers/languages.ts scripts/transformers/proficiencies.ts
git commit -m "feat: add transformers for traits, languages, and proficiencies"
```

---

## Task 8: Race & Subrace Transformer

**Files:**
- Create: `scripts/transformers/races.ts`
- Test: `tests/transformers/races.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/transformers/races.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transformRaceEntry, transformSubraceEntry } from "@/scripts/transformers/races";

describe("transformRaceEntry", () => {
  it("transforms an elf race from API data", () => {
    const apiRace = {
      index: "elf",
      name: "Elf",
      speed: 30,
      ability_bonuses: [{ ability_score: { index: "dex", name: "DEX" }, bonus: 2 }],
      size: "Medium",
      size_description: "Elves range from under 5 to over 6 feet tall",
      age: "Elves reach maturity around 100",
      alignment: "Elves love freedom and variety",
      languages: [{ index: "common", name: "Common" }, { index: "elvish", name: "Elvish" }],
      language_desc: "You can speak, read, and write Common and Elvish",
      traits: [{ index: "darkvision", name: "Darkvision" }, { index: "fey-ancestry", name: "Fey Ancestry" }],
      subraces: [{ index: "high-elf", name: "High Elf" }],
      starting_proficiencies: [],
      starting_proficiency_options: undefined,
    };

    const result = transformRaceEntry(apiRace);
    expect(result.slug).toBe("elf");
    expect(result.name).toBe("Elf");
    expect(result.content_type).toBe("race");
    expect(result.data.size).toBe("Medium");
    expect(result.data.speed).toBe(30);
    expect(result.data.traits).toEqual(["darkvision", "fey-ancestry"]);
    expect(result.data.subraces).toEqual(["high-elf"]);
    expect(result.data.languages).toEqual(["common", "elvish"]);

    const mechEffects = result.effects.filter((e) => e.type === "mechanical");
    expect(mechEffects).toContainEqual({
      type: "mechanical", stat: "dexterity", op: "add", value: 2,
    });
    expect(mechEffects).toContainEqual({
      type: "mechanical", stat: "movement_speed", op: "set", value: 30,
    });
  });
});

describe("transformSubraceEntry", () => {
  it("transforms a high elf subrace", () => {
    const apiSubrace = {
      index: "high-elf",
      name: "High Elf",
      desc: "As a high elf, you have a keen mind",
      race: { index: "elf", name: "Elf" },
      ability_bonuses: [{ ability_score: { index: "int", name: "INT" }, bonus: 1 }],
      racial_traits: [{ index: "elf-weapon-training", name: "Elf Weapon Training" }],
      starting_proficiencies: [],
      languages: [],
      language_options: undefined,
    };

    const result = transformSubraceEntry(apiSubrace);
    expect(result.slug).toBe("high-elf");
    expect(result.content_type).toBe("subrace");
    expect(result.data.parent_race).toBe("elf");

    const mechEffects = result.effects.filter((e) => e.type === "mechanical");
    expect(mechEffects).toContainEqual({
      type: "mechanical", stat: "intelligence", op: "add", value: 1,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/transformers/races.test.ts
```

- [ ] **Step 3: Implement race transformer**

Create `scripts/transformers/races.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry, buildMechanicalEffect, buildAbilityBonusEffects, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect } from "@/lib/types/effects";

interface ApiRace {
  index: string;
  name: string;
  speed: number;
  ability_bonuses: Array<{ ability_score: { index: string; name: string }; bonus: number }>;
  size: string;
  size_description: string;
  age: string;
  alignment: string;
  languages: Array<{ index: string; name: string }>;
  language_desc: string;
  traits: Array<{ index: string; name: string }>;
  subraces: Array<{ index: string; name: string }>;
  starting_proficiencies: Array<{ index: string; name: string }>;
  starting_proficiency_options?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
  language_options?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
}

export function transformRaceEntry(apiRace: ApiRace): TransformedContent {
  const effects: Effect[] = [];

  // Ability bonuses
  effects.push(...buildAbilityBonusEffects(apiRace.ability_bonuses));

  // Speed
  effects.push(buildMechanicalEffect("movement_speed", "set", apiRace.speed));

  // Size
  effects.push(buildMechanicalEffect("size", "set", apiRace.size));

  // Starting proficiency grants
  for (const prof of apiRace.starting_proficiencies) {
    effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
  }

  // Proficiency choices
  if (apiRace.starting_proficiency_options) {
    const opts = apiRace.starting_proficiency_options;
    const options = opts.from.options.map((o) => normalizeSlug(o.item.index));
    effects.push(buildChoiceEffect(opts.choose, options, "proficiency", `${apiRace.index}-proficiency-choice`));
  }

  // Language choices
  if (apiRace.language_options) {
    const opts = apiRace.language_options;
    const options = opts.from.options.map((o) => normalizeSlug(o.item.index));
    effects.push(buildChoiceEffect(opts.choose, options, "language", `${apiRace.index}-language-choice`));
  }

  return buildContentEntry("race", apiRace.index, apiRace.name, {
    size: apiRace.size,
    speed: apiRace.speed,
    age_description: apiRace.age,
    alignment_description: apiRace.alignment,
    size_description: apiRace.size_description,
    language_description: apiRace.language_desc,
    traits: apiRace.traits.map((t) => t.index),
    subraces: apiRace.subraces.map((s) => s.index),
    languages: apiRace.languages.map((l) => l.index),
  }, effects);
}

interface ApiSubrace {
  index: string;
  name: string;
  desc: string;
  race: { index: string; name: string };
  ability_bonuses: Array<{ ability_score: { index: string; name: string }; bonus: number }>;
  racial_traits: Array<{ index: string; name: string }>;
  starting_proficiencies: Array<{ index: string; name: string }>;
  languages: Array<{ index: string; name: string }>;
  language_options?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
}

export function transformSubraceEntry(apiSubrace: ApiSubrace): TransformedContent {
  const effects: Effect[] = [];

  effects.push(...buildAbilityBonusEffects(apiSubrace.ability_bonuses));

  for (const prof of apiSubrace.starting_proficiencies) {
    effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
  }

  if (apiSubrace.language_options) {
    const opts = apiSubrace.language_options;
    const options = opts.from.options.map((o) => normalizeSlug(o.item.index));
    effects.push(buildChoiceEffect(opts.choose, options, "language", `${apiSubrace.index}-language-choice`));
  }

  return buildContentEntry("subrace", apiSubrace.index, apiSubrace.name, {
    parent_race: apiSubrace.race.index,
    description: apiSubrace.desc,
    traits: apiSubrace.racial_traits.map((t) => t.index),
    languages: apiSubrace.languages.map((l) => l.index),
  }, effects);
}

export async function transformRaces(): Promise<TransformedContent[]> {
  const races = await fetchAllFromApi<ApiRace>("/races");
  const subraces = await fetchAllFromApi<ApiSubrace>("/subraces");
  return [
    ...races.map(transformRaceEntry),
    ...subraces.map(transformSubraceEntry),
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/transformers/races.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/transformers/races.ts tests/transformers/races.test.ts
git commit -m "feat: add race and subrace transformer with effect mapping"
```

---

## Task 9: Spell Transformer

**Files:**
- Create: `scripts/transformers/spells.ts`
- Test: `tests/transformers/spells.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/transformers/spells.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transformSpellEntry } from "@/scripts/transformers/spells";

describe("transformSpellEntry", () => {
  it("transforms a damage spell (Fireball)", () => {
    const apiSpell = {
      index: "fireball",
      name: "Fireball",
      desc: ["A bright streak flashes from your pointing finger..."],
      higher_level: ["When you cast this spell using a spell slot of 4th level or higher..."],
      range: "150 feet",
      components: ["V", "S", "M"],
      material: "A tiny ball of bat guano and sulfur",
      ritual: false,
      duration: "Instantaneous",
      concentration: false,
      casting_time: "1 action",
      level: 3,
      damage: {
        damage_type: { index: "fire", name: "Fire" },
        damage_at_slot_level: { "3": "8d6", "4": "9d6", "5": "10d6", "6": "11d6", "7": "12d6", "8": "13d6", "9": "14d6" },
      },
      dc: { dc_type: { index: "dex", name: "DEX" }, dc_success: "half" },
      area_of_effect: { type: "sphere", size: 20 },
      school: { index: "evocation", name: "Evocation" },
      classes: [{ index: "sorcerer", name: "Sorcerer" }, { index: "wizard", name: "Wizard" }],
      subclasses: [{ index: "fiend", name: "Fiend" }],
      heal_at_slot_level: undefined,
    };

    const result = transformSpellEntry(apiSpell);
    expect(result.slug).toBe("fireball");
    expect(result.content_type).toBe("spell");
    expect(result.data.level).toBe(3);
    expect(result.data.school).toBe("evocation");
    expect(result.data.concentration).toBe(false);
    expect(result.data.damage).toEqual({
      type: "fire",
      dice_at_slot_level: { "3": "8d6", "4": "9d6", "5": "10d6", "6": "11d6", "7": "12d6", "8": "13d6", "9": "14d6" },
    });
    expect(result.data.dc).toEqual({ type: "dexterity", success: "half" });
    expect(result.data.classes).toEqual(["sorcerer", "wizard"]);
  });

  it("transforms a cantrip with no damage", () => {
    const apiSpell = {
      index: "light",
      name: "Light",
      desc: ["You touch one object..."],
      range: "Touch",
      components: ["V"],
      ritual: false,
      duration: "1 hour",
      concentration: false,
      casting_time: "1 action",
      level: 0,
      school: { index: "evocation", name: "Evocation" },
      classes: [{ index: "cleric", name: "Cleric" }],
      subclasses: [],
    };

    const result = transformSpellEntry(apiSpell);
    expect(result.data.level).toBe(0);
    expect(result.data.damage).toBeNull();
    expect(result.data.dc).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/transformers/spells.test.ts
```

- [ ] **Step 3: Implement spell transformer**

Create `scripts/transformers/spells.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry, expandAbilityAbbreviation } from "./common";
import type { TransformedContent } from "./common";

interface ApiSpell {
  index: string;
  name: string;
  desc: string[];
  higher_level?: string[];
  range: string;
  components: string[];
  material?: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  casting_time: string;
  level: number;
  damage?: {
    damage_type: { index: string; name: string };
    damage_at_slot_level?: Record<string, string>;
    damage_at_character_level?: Record<string, string>;
  };
  heal_at_slot_level?: Record<string, string>;
  dc?: {
    dc_type: { index: string; name: string };
    dc_success: string;
  };
  area_of_effect?: {
    type: string;
    size: number;
  };
  school: { index: string; name: string };
  classes: Array<{ index: string; name: string }>;
  subclasses: Array<{ index: string; name: string }>;
}

export function transformSpellEntry(apiSpell: ApiSpell): TransformedContent {
  const damage = apiSpell.damage
    ? {
        type: apiSpell.damage.damage_type.index,
        dice_at_slot_level: apiSpell.damage.damage_at_slot_level ?? apiSpell.damage.damage_at_character_level ?? {},
      }
    : null;

  const dc = apiSpell.dc
    ? {
        type: expandAbilityAbbreviation(apiSpell.dc.dc_type.index),
        success: apiSpell.dc.dc_success as "half" | "none" | "other",
      }
    : null;

  const aoe = apiSpell.area_of_effect
    ? {
        type: apiSpell.area_of_effect.type as "sphere" | "cone" | "cylinder" | "line" | "cube",
        size: apiSpell.area_of_effect.size,
      }
    : null;

  return buildContentEntry("spell", apiSpell.index, apiSpell.name, {
    level: apiSpell.level,
    school: apiSpell.school.index,
    casting_time: apiSpell.casting_time,
    range: apiSpell.range,
    components: apiSpell.components,
    material: apiSpell.material,
    duration: apiSpell.duration,
    concentration: apiSpell.concentration,
    ritual: apiSpell.ritual,
    description: apiSpell.desc.join("\n"),
    higher_level: apiSpell.higher_level?.join("\n"),
    damage,
    heal_at_slot_level: apiSpell.heal_at_slot_level ?? null,
    dc,
    area_of_effect: aoe,
    classes: apiSpell.classes.map((c) => c.index),
    subclasses: apiSpell.subclasses.map((s) => s.index),
  });
}

export async function transformSpells(): Promise<TransformedContent[]> {
  const spells = await fetchAllFromApi<ApiSpell>("/spells");
  return spells.map(transformSpellEntry);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/transformers/spells.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/transformers/spells.ts tests/transformers/spells.test.ts
git commit -m "feat: add spell transformer with damage, DC, and AoE mapping"
```

---

## Task 10: Equipment Transformer

**Files:**
- Create: `scripts/transformers/equipment.ts`
- Test: `tests/transformers/equipment.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/transformers/equipment.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transformEquipmentEntry } from "@/scripts/transformers/equipment";

describe("transformEquipmentEntry", () => {
  it("transforms a weapon (longsword)", () => {
    const apiItem = {
      index: "longsword",
      name: "Longsword",
      equipment_category: { index: "weapon", name: "Weapon" },
      weapon_category: "Martial",
      weapon_range: "Melee",
      category_range: "Martial Melee",
      cost: { quantity: 15, unit: "gp" },
      weight: 3,
      damage: { damage_dice: "1d8", damage_type: { index: "slashing", name: "Slashing" } },
      range: { normal: 5 },
      properties: [{ index: "versatile", name: "Versatile" }],
      two_handed_damage: { damage_dice: "1d10", damage_type: { index: "slashing", name: "Slashing" } },
    };

    const result = transformEquipmentEntry(apiItem);
    expect(result.content_type).toBe("weapon");
    expect(result.data.weapon_category).toBe("Martial");
    expect(result.data.damage).toEqual({ dice: "1d8", type: "slashing" });
    expect(result.data.two_handed_damage).toEqual({ dice: "1d10", type: "slashing" });
  });

  it("transforms armor (chain mail)", () => {
    const apiItem = {
      index: "chain-mail",
      name: "Chain Mail",
      equipment_category: { index: "armor", name: "Armor" },
      armor_category: "Heavy",
      armor_class: { base: 16, dex_bonus: false, max_bonus: null },
      str_minimum: 13,
      stealth_disadvantage: true,
      cost: { quantity: 75, unit: "gp" },
      weight: 55,
    };

    const result = transformEquipmentEntry(apiItem);
    expect(result.content_type).toBe("armor");
    expect(result.data.armor_category).toBe("Heavy");
    expect(result.data.armor_class).toEqual({ base: 16, dex_bonus: false, max_bonus: null });
  });

  it("transforms general equipment", () => {
    const apiItem = {
      index: "backpack",
      name: "Backpack",
      equipment_category: { index: "adventuring-gear", name: "Adventuring Gear" },
      cost: { quantity: 2, unit: "gp" },
      weight: 5,
      desc: ["A backpack can hold..."],
    };

    const result = transformEquipmentEntry(apiItem);
    expect(result.content_type).toBe("item");
    expect(result.data.equipment_category).toBe("Adventuring Gear");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/transformers/equipment.test.ts
```

- [ ] **Step 3: Implement equipment transformer**

Create `scripts/transformers/equipment.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry } from "./common";
import type { TransformedContent } from "./common";

interface ApiEquipment {
  index: string;
  name: string;
  equipment_category: { index: string; name: string };
  weapon_category?: string;
  weapon_range?: string;
  category_range?: string;
  armor_category?: string;
  armor_class?: { base: number; dex_bonus: boolean; max_bonus: number | null };
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  cost?: { quantity: number; unit: string };
  weight?: number;
  damage?: { damage_dice: string; damage_type: { index: string; name: string } };
  two_handed_damage?: { damage_dice: string; damage_type: { index: string; name: string } };
  range?: { normal: number; long?: number };
  properties?: Array<{ index: string; name: string }>;
  desc?: string[];
}

export function transformEquipmentEntry(apiItem: ApiEquipment): TransformedContent {
  const category = apiItem.equipment_category.index;

  if (category === "weapon" && apiItem.weapon_category) {
    return buildContentEntry("weapon", apiItem.index, apiItem.name, {
      weapon_category: apiItem.weapon_category,
      weapon_range: apiItem.weapon_range ?? "Melee",
      cost: apiItem.cost ?? null,
      weight: apiItem.weight ?? null,
      damage: apiItem.damage
        ? { dice: apiItem.damage.damage_dice, type: apiItem.damage.damage_type.index }
        : null,
      range: apiItem.range ?? null,
      properties: (apiItem.properties ?? []).map((p) => p.index),
      two_handed_damage: apiItem.two_handed_damage
        ? { dice: apiItem.two_handed_damage.damage_dice, type: apiItem.two_handed_damage.damage_type.index }
        : null,
    });
  }

  if (category === "armor" && apiItem.armor_category) {
    return buildContentEntry("armor", apiItem.index, apiItem.name, {
      armor_category: apiItem.armor_category,
      cost: apiItem.cost ?? null,
      weight: apiItem.weight ?? null,
      armor_class: apiItem.armor_class ?? { base: 0, dex_bonus: false, max_bonus: null },
      str_minimum: apiItem.str_minimum ?? 0,
      stealth_disadvantage: apiItem.stealth_disadvantage ?? false,
    });
  }

  // General equipment
  return buildContentEntry("item", apiItem.index, apiItem.name, {
    equipment_category: apiItem.equipment_category.name,
    cost: apiItem.cost ?? null,
    weight: apiItem.weight ?? null,
    description: (apiItem.desc ?? []).join("\n"),
  });
}

export async function transformEquipment(): Promise<TransformedContent[]> {
  const equipment = await fetchAllFromApi<ApiEquipment>("/equipment");
  return equipment.map(transformEquipmentEntry);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/transformers/equipment.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/transformers/equipment.ts tests/transformers/equipment.test.ts
git commit -m "feat: add equipment transformer for weapons, armor, and general items"
```

---

## Task 11: Class, Feature, Background, Feat & Magic Item Transformers

**Files:**
- Create: `scripts/transformers/features.ts`, `scripts/transformers/classes.ts`, `scripts/transformers/backgrounds.ts`, `scripts/transformers/feats.ts`, `scripts/transformers/magic-items.ts`
- Test: `tests/transformers/classes.test.ts`

- [ ] **Step 1: Write failing test for class transformer**

Create `tests/transformers/classes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transformClassEntry } from "@/scripts/transformers/classes";

describe("transformClassEntry", () => {
  it("transforms a non-caster class (Fighter)", () => {
    const apiClass = {
      index: "fighter",
      name: "Fighter",
      hit_die: 10,
      proficiency_choices: [{
        choose: 2,
        from: { options: [
          { item: { index: "skill-athletics", name: "Athletics" } },
          { item: { index: "skill-acrobatics", name: "Acrobatics" } },
          { item: { index: "skill-history", name: "History" } },
        ] },
      }],
      proficiencies: [
        { index: "all-armor", name: "All armor" },
        { index: "shields", name: "Shields" },
      ],
      saving_throws: [{ index: "str", name: "STR" }, { index: "con", name: "CON" }],
      starting_equipment: [],
      starting_equipment_options: [],
      subclasses: [{ index: "champion", name: "Champion" }],
      spellcasting: undefined,
      multi_classing: {
        prerequisites: [{ ability_score: { index: "str", name: "STR" }, minimum_score: 13 }],
        proficiencies: [{ index: "light-armor", name: "Light armor" }],
      },
    };
    const apiLevels = [
      { level: 1, ability_score_bonuses: 0, prof_bonus: 2, features: [{ index: "fighting-style", name: "Fighting Style" }], spellcasting: undefined, class_specific: {} },
      { level: 2, ability_score_bonuses: 0, prof_bonus: 2, features: [{ index: "action-surge", name: "Action Surge" }], spellcasting: undefined, class_specific: {} },
      { level: 3, ability_score_bonuses: 0, prof_bonus: 2, features: [], spellcasting: undefined, class_specific: {}, subclass: { index: "champion" } },
    ];

    const result = transformClassEntry(apiClass, apiLevels);
    expect(result.slug).toBe("fighter");
    expect(result.data.hit_die).toBe(10);
    expect(result.data.spellcasting).toBeNull();
    expect(result.data.saving_throws).toEqual(["strength", "constitution"]);
    expect(result.data.multiclass.prerequisites).toEqual([
      { stat: "strength", op: "gte", value: 13 },
    ]);
    expect(result.data.levels).toHaveLength(3);
    expect(result.data.levels[0].features).toContain("fighting-style");
    expect(result.data.levels[2].subclass_level).toBe(true);

    const choiceEffects = result.effects.filter((e) => e.type === "choice");
    expect(choiceEffects.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/transformers/classes.test.ts
```

- [ ] **Step 3: Create features transformer**

Create `scripts/transformers/features.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect } from "./common";
import type { TransformedContent } from "./common";

interface ApiFeature {
  index: string;
  name: string;
  class: { index: string; name: string };
  subclass?: { index: string; name: string };
  level: number;
  desc: string[];
  prerequisites: Array<unknown>;
}

export async function transformFeatures(): Promise<TransformedContent[]> {
  const features = await fetchAllFromApi<ApiFeature>("/features");
  return features.map((feature) => {
    const effects = [];
    if (feature.desc.length > 0) {
      effects.push(buildNarrativeEffect(feature.desc.join("\n"), "Class Feature"));
    }

    return buildContentEntry("feature", feature.index, feature.name, {
      class: feature.class.index,
      subclass: feature.subclass?.index ?? null,
      level: feature.level,
      description: feature.desc.join("\n"),
    }, effects);
  });
}
```

- [ ] **Step 4: Create class transformer**

Create `scripts/transformers/classes.ts`:

```typescript
import { fetchFromApi, fetchAllFromApi, buildContentEntry, buildChoiceEffect, buildGrantEffect, expandAbilityAbbreviation, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect, StatCondition } from "@/lib/types/effects";

interface ApiClass {
  index: string;
  name: string;
  hit_die: number;
  proficiency_choices: Array<{
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  }>;
  proficiencies: Array<{ index: string; name: string }>;
  saving_throws: Array<{ index: string; name: string }>;
  starting_equipment: Array<unknown>;
  starting_equipment_options: Array<unknown>;
  subclasses: Array<{ index: string; name: string }>;
  spellcasting?: {
    level: number;
    spellcasting_ability: { index: string; name: string };
    info: Array<{ name: string; desc: string[] }>;
  };
  multi_classing: {
    prerequisites?: Array<{ ability_score: { index: string; name: string }; minimum_score: number }>;
    proficiencies: Array<{ index: string; name: string }>;
  };
}

interface ApiClassLevel {
  level: number;
  ability_score_bonuses: number;
  prof_bonus: number;
  features: Array<{ index: string; name: string }>;
  spellcasting?: {
    cantrips_known?: number;
    spell_slots_level_1?: number;
    spell_slots_level_2?: number;
    spell_slots_level_3?: number;
    spell_slots_level_4?: number;
    spell_slots_level_5?: number;
    spell_slots_level_6?: number;
    spell_slots_level_7?: number;
    spell_slots_level_8?: number;
    spell_slots_level_9?: number;
  };
  class_specific: Record<string, unknown>;
  subclass?: { index: string };
}

interface ApiSubclass {
  index: string;
  name: string;
  class: { index: string; name: string };
  subclass_flavor: string;
  desc: string[];
  subclass_levels: string;
  spells?: Array<{ spell: { index: string; name: string } }>;
}

function mapSpellcastingType(className: string): "full" | "half" | "third" | "pact" | null {
  const fullCasters = ["wizard", "sorcerer", "cleric", "druid", "bard"];
  const halfCasters = ["paladin", "ranger"];
  const thirdCasters = ["eldritch-knight", "arcane-trickster"];
  if (fullCasters.includes(className)) return "full";
  if (halfCasters.includes(className)) return "half";
  if (thirdCasters.includes(className)) return "third";
  if (className === "warlock") return "pact";
  return null;
}

export function transformClassEntry(apiClass: ApiClass, apiLevels: ApiClassLevel[]): TransformedContent {
  const effects: Effect[] = [];

  // Proficiency choices (e.g., choose 2 skills)
  for (let i = 0; i < apiClass.proficiency_choices.length; i++) {
    const choice = apiClass.proficiency_choices[i];
    const options = choice.from.options.map((o) => normalizeSlug(o.item.index));
    effects.push(buildChoiceEffect(
      choice.choose,
      options,
      "proficiency",
      `${apiClass.index}-proficiency-choice-${i}`
    ));
  }

  // Saving throw proficiencies
  for (const save of apiClass.saving_throws) {
    effects.push(buildGrantEffect(`save_${expandAbilityAbbreviation(save.index)}`, "proficient"));
  }

  // Multiclass prerequisites
  const prerequisites: StatCondition[] = (apiClass.multi_classing.prerequisites ?? []).map((p) => ({
    stat: expandAbilityAbbreviation(p.ability_score.index),
    op: "gte" as const,
    value: p.minimum_score,
  }));

  // Spellcasting config
  const spellcasting = apiClass.spellcasting
    ? {
        ability: expandAbilityAbbreviation(apiClass.spellcasting.spellcasting_ability.index),
        type: mapSpellcastingType(apiClass.index) ?? "full",
        focus: "",
        ritual_casting: false,
      }
    : null;

  // Level progression
  const sortedLevels = [...apiLevels].sort((a, b) => a.level - b.level);
  const levels = sortedLevels.map((lvl) => {
    const spellSlots = lvl.spellcasting
      ? [
          lvl.spellcasting.spell_slots_level_1 ?? 0,
          lvl.spellcasting.spell_slots_level_2 ?? 0,
          lvl.spellcasting.spell_slots_level_3 ?? 0,
          lvl.spellcasting.spell_slots_level_4 ?? 0,
          lvl.spellcasting.spell_slots_level_5 ?? 0,
          lvl.spellcasting.spell_slots_level_6 ?? 0,
          lvl.spellcasting.spell_slots_level_7 ?? 0,
          lvl.spellcasting.spell_slots_level_8 ?? 0,
          lvl.spellcasting.spell_slots_level_9 ?? 0,
        ]
      : null;

    return {
      level: lvl.level,
      features: lvl.features.map((f) => f.index),
      spellcasting: spellSlots
        ? { cantrips_known: lvl.spellcasting?.cantrips_known, spell_slots: spellSlots }
        : null,
      ...(lvl.subclass ? { subclass_level: true } : {}),
      ...(Object.keys(lvl.class_specific).length > 0 ? { class_specific: lvl.class_specific } : {}),
    };
  });

  return buildContentEntry("class", apiClass.index, apiClass.name, {
    hit_die: apiClass.hit_die,
    spellcasting,
    multiclass: {
      prerequisites,
      proficiencies_gained: apiClass.multi_classing.proficiencies.map((p) => p.index),
    },
    saving_throws: apiClass.saving_throws.map((s) => expandAbilityAbbreviation(s.index)),
    starting_proficiencies: apiClass.proficiencies.map((p) => p.index),
    levels,
  }, effects);
}

export async function transformClasses(): Promise<TransformedContent[]> {
  const classes = await fetchAllFromApi<ApiClass>("/classes");
  const results: TransformedContent[] = [];

  for (const cls of classes) {
    const levels = await fetchFromApi<ApiClassLevel[]>(`/classes/${cls.index}/levels`);
    results.push(transformClassEntry(cls, levels));
  }

  // Subclasses
  const subclasses = await fetchAllFromApi<ApiSubclass>("/subclasses");
  for (const sub of subclasses) {
    const subLevels = await fetchFromApi<ApiClassLevel[]>(`/subclasses/${sub.index}/levels`);
    const levels = subLevels.map((lvl) => ({
      level: lvl.level,
      features: lvl.features.map((f) => f.index),
    }));

    results.push(buildContentEntry("subclass", sub.index, sub.name, {
      parent_class: sub.class.index,
      flavor_label: sub.subclass_flavor,
      description: sub.desc.join("\n"),
      levels,
      spells: (sub.spells ?? []).map((s) => s.spell.index),
    }));
  }

  return results;
}
```

- [ ] **Step 5: Create backgrounds transformer**

Create `scripts/transformers/backgrounds.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect } from "@/lib/types/effects";

interface ApiBackground {
  index: string;
  name: string;
  starting_proficiencies: Array<{ index: string; name: string }>;
  language_options?: { choose: number; from: { options: Array<{ item: { index: string } }> } };
  starting_equipment: Array<{ equipment: { index: string; name: string }; quantity: number }>;
  starting_equipment_options: Array<unknown>;
  feature: { name: string; desc: string[] };
  personality_traits: { choose: number; from: { options: Array<{ string: string }> } };
  ideals: { choose: number; from: { options: Array<{ desc: string; alignments: Array<{ index: string }> }> } };
  bonds: { choose: number; from: { options: Array<{ string: string }> } };
  flaws: { choose: number; from: { options: Array<{ string: string }> } };
}

export async function transformBackgrounds(): Promise<TransformedContent[]> {
  const backgrounds = await fetchAllFromApi<ApiBackground>("/backgrounds");
  return backgrounds.map((bg) => {
    const effects: Effect[] = [];

    for (const prof of bg.starting_proficiencies) {
      effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
    }

    if (bg.language_options) {
      const opts = bg.language_options;
      const options = opts.from.options.map((o) => normalizeSlug(o.item.index));
      effects.push(buildChoiceEffect(opts.choose, options.length > 0 ? options : "all_languages", "language", `${bg.index}-language-choice`));
    }

    const personalityTraits = bg.personality_traits?.from?.options?.map((o) => o.string) ?? [];
    const ideals = bg.ideals?.from?.options?.map((o) => ({
      text: o.desc,
      alignment: o.alignments?.[0]?.index ?? "",
    })) ?? [];
    const bonds = bg.bonds?.from?.options?.map((o) => o.string) ?? [];
    const flaws = bg.flaws?.from?.options?.map((o) => o.string) ?? [];

    return buildContentEntry("background", bg.index, bg.name, {
      feature: {
        name: bg.feature.name,
        description: bg.feature.desc.join("\n"),
      },
      personality_traits: personalityTraits,
      ideals,
      bonds,
      flaws,
    }, effects);
  });
}
```

- [ ] **Step 6: Create feats transformer**

Create `scripts/transformers/feats.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect, expandAbilityAbbreviation } from "./common";
import type { TransformedContent } from "./common";
import type { StatCondition } from "@/lib/types/effects";

interface ApiFeat {
  index: string;
  name: string;
  desc: string[];
  prerequisites: Array<{ ability_score?: { index: string }; minimum_score?: number }>;
}

export async function transformFeats(): Promise<TransformedContent[]> {
  const feats = await fetchAllFromApi<ApiFeat>("/feats");
  return feats.map((feat) => {
    const prerequisites: StatCondition[] = feat.prerequisites
      .filter((p) => p.ability_score && p.minimum_score)
      .map((p) => ({
        stat: expandAbilityAbbreviation(p.ability_score!.index),
        op: "gte" as const,
        value: p.minimum_score!,
      }));

    const effects = [];
    if (feat.desc.length > 0) {
      effects.push(buildNarrativeEffect(feat.desc.join("\n"), "Feat"));
    }

    return buildContentEntry("feat", feat.index, feat.name, {
      description: feat.desc.join("\n"),
      prerequisites,
    }, effects);
  });
}
```

- [ ] **Step 7: Create magic items transformer**

Create `scripts/transformers/magic-items.ts`:

```typescript
import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect } from "./common";
import type { TransformedContent } from "./common";

interface ApiMagicItem {
  index: string;
  name: string;
  desc: string[];
  equipment_category: { index: string; name: string };
  rarity: { name: string };
}

export async function transformMagicItems(): Promise<TransformedContent[]> {
  const items = await fetchAllFromApi<ApiMagicItem>("/magic-items");
  return items.map((item) => {
    const effects = [];
    if (item.desc.length > 0) {
      effects.push(buildNarrativeEffect(item.desc.join("\n"), "Magic Item"));
    }

    return buildContentEntry("magic_item", item.index, item.name, {
      rarity: item.rarity.name,
      description: item.desc.join("\n"),
      equipment_category: item.equipment_category.name,
    }, effects);
  });
}
```

- [ ] **Step 8: Run class test to verify it passes**

```bash
npx vitest run tests/transformers/classes.test.ts
```

Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add scripts/transformers/
git commit -m "feat: add transformers for features, classes, subclasses, backgrounds, feats, magic items"
```

---

## Task 12: Import Orchestrator

**Files:**
- Create: `scripts/import-srd.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add data directory to gitignore**

Append to `.gitignore`:

```
data/srd-2014/raw/
```

- [ ] **Step 2: Create import orchestrator**

Create `scripts/import-srd.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { transformTraits } from "./transformers/traits";
import { transformLanguages } from "./transformers/languages";
import { transformProficiencies } from "./transformers/proficiencies";
import { transformRaces } from "./transformers/races";
import { transformFeatures } from "./transformers/features";
import { transformClasses } from "./transformers/classes";
import { transformBackgrounds } from "./transformers/backgrounds";
import { transformFeats } from "./transformers/feats";
import { transformSpells } from "./transformers/spells";
import { transformEquipment } from "./transformers/equipment";
import { transformMagicItems } from "./transformers/magic-items";
import type { TransformedContent } from "./transformers/common";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getSystemId(): Promise<string> {
  const { data, error } = await supabase
    .from("game_systems")
    .select("id")
    .eq("slug", "dnd-5e-2014")
    .single();

  if (error || !data) {
    throw new Error("Could not find dnd-5e-2014 game system. Run seed.sql first.");
  }
  return data.id;
}

async function upsertContent(systemId: string, content: TransformedContent[]): Promise<void> {
  const rows = content.map((c) => ({
    system_id: systemId,
    content_type: c.content_type,
    slug: c.slug,
    name: c.name,
    data: c.data,
    effects: c.effects,
    source: "srd",
    scope: "platform",
    owner_id: null,
    version: 1,
  }));

  // Batch insert in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("content_definitions")
      .upsert(chunk, { onConflict: "system_id,content_type,slug,owner_id" });

    if (error) {
      console.error(`Error inserting chunk at index ${i}:`, error.message);
    }
  }
}

async function saveRawData(name: string, data: unknown): Promise<void> {
  const dir = path.join(process.cwd(), "data", "srd-2014", "raw");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
}

interface ImportStep {
  name: string;
  transform: () => Promise<TransformedContent[]>;
}

const IMPORT_STEPS: ImportStep[] = [
  { name: "traits", transform: transformTraits },
  { name: "languages", transform: transformLanguages },
  { name: "proficiencies", transform: transformProficiencies },
  { name: "races", transform: transformRaces },
  { name: "features", transform: transformFeatures },
  { name: "classes", transform: transformClasses },
  { name: "backgrounds", transform: transformBackgrounds },
  { name: "feats", transform: transformFeats },
  { name: "spells", transform: transformSpells },
  { name: "equipment", transform: transformEquipment },
  { name: "magic-items", transform: transformMagicItems },
];

async function main() {
  console.log("Starting D&D 5e 2014 SRD import...\n");

  const systemId = await getSystemId();
  console.log(`Found game system: ${systemId}\n`);

  let totalCount = 0;

  for (const step of IMPORT_STEPS) {
    console.log(`Transforming ${step.name}...`);
    try {
      const content = await step.transform();
      console.log(`  → ${content.length} entries`);

      await saveRawData(step.name, content);
      await upsertContent(systemId, content);

      totalCount += content.length;
      console.log(`  ✓ Loaded\n`);
    } catch (err) {
      console.error(`  ✗ Error in ${step.name}:`, err);
    }
  }

  console.log(`\nDone! Imported ${totalCount} total content entries.`);
}

main().catch(console.error);
```

- [ ] **Step 3: Add import script to package.json**

Add to `scripts` in `package.json`:

```json
"import:srd": "npx tsx scripts/import-srd.ts"
```

- [ ] **Step 4: Install tsx for running TypeScript scripts**

```bash
npm install -D tsx
```

- [ ] **Step 5: Commit**

```bash
git add scripts/import-srd.ts .gitignore package.json package-lock.json
git commit -m "feat: add SRD import orchestrator with fetch-transform-load pipeline"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (existing engine tests + new schema tests + transformer tests).

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve issues found during final verification"
```

- [ ] **Step 5: Document import usage**

The import script requires:
1. A running Supabase instance with the seed data applied (dnd-5e-2014 system must exist)
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. Run: `npm run import:srd`

This is not run automatically — it's a manual step after setting up Supabase.
