# D&D 5e 2014 SRD Content Import — Design Spec

**Date:** 2026-04-07
**Sub-project:** 2 of 9 — D&D 5e 2014 SRD Content
**Scope:** Schema extensions, content-type data schemas, API import script, SRD content seeding
**Data Source:** https://www.dnd5eapi.co/api/2014/ (MIT license, SRD/OGL data)

---

## Overview

This sub-project extends the Inkborne type system and schemas to handle the full breadth of D&D 5e content, then imports the 2014 SRD from the community REST API into `content_definitions`. The result is ~1,100+ content entries (races, classes, spells, equipment, etc.) ready for the character builder to consume.

No database table changes are needed — the existing `content_definitions` table with its `data` JSONB column handles all content types. The work is in defining what that JSONB looks like per content type and transforming the API data to match.

---

## Schema & Type Extensions

### New Effect Type: Choice

A `choice` effect represents a selection prompt presented during character creation. It produces `grant` effects based on the player's selections.

```typescript
interface ChoiceEffect {
  type: "choice";
  choose: number;                    // how many to pick
  from: string[] | string;           // explicit list of slugs, or category like "all_languages"
  grant_type: string;                // "skill_proficiency", "language", "tool_proficiency", "equipment"
  choice_id: string;                 // stable ID for linking grants back to this choice (enables reversal)
}
```

Added to the `Effect` union type in `lib/types/effects.ts` and the `effectSchema` discriminated union in `lib/schemas/effects.ts`.

**Reversal support:** When a player changes a choice (respec, level-down), the character builder uses `choice_id` to find all grants linked to that choice, removes them, and re-presents the selection. The expression engine recomputes. This sub-project defines the data structure; the reversal UI is built in the Character Builder sub-project.

### Taxonomy Constants

New file `lib/types/taxonomies.ts` defining reference arrays for:

- **Damage types:** acid, bludgeoning, cold, fire, force, lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder
- **Magic schools:** abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy, transmutation
- **Creature sizes:** Tiny, Small, Medium, Large, Huge, Gargantuan
- **Armor categories:** Light, Medium, Heavy, Shield
- **Weapon categories:** Simple, Martial
- **Weapon properties:** ammunition, finesse, heavy, light, loading, range, reach, special, thrown, two-handed, versatile
- **Proficiency types:** skill, armor, weapon, tool, saving_throw

These are TypeScript `as const` arrays with derived union types, not enums.

---

## Content-Type Data Schemas

Each content type gets a Zod schema in `lib/schemas/content-types/` that validates the `data` JSONB column of `content_definitions`. The `content_type` field on the row determines which schema applies.

### Race (`raceDataSchema`)

```typescript
{
  size: "Medium",                           // creature size
  speed: 30,                                // base walking speed
  age_description: "...",                   // flavor text
  alignment_description: "...",             // flavor text
  size_description: "...",                  // flavor text
  language_description: "...",              // flavor text
  traits: ["darkvision", "fey-ancestry"],   // slugs of trait content entries
  subraces: ["high-elf", "wood-elf"],       // slugs of subrace content entries
  languages: ["common", "elvish"]           // granted language slugs
}
```

Effects array: ability bonuses as mechanical effects, language/proficiency choices as choice effects, proficiency grants as grant effects.

### Subrace (`subraceDataSchema`)

```typescript
{
  parent_race: "elf",                       // slug of parent race
  description: "...",
  traits: ["elf-weapon-training"],          // additional trait slugs
  languages: []                             // additional language slugs
}
```

Effects array: additional ability bonuses, proficiency grants.

### Class (`classDataSchema`)

```typescript
{
  hit_die: 10,
  spellcasting: {                           // null for non-casters
    ability: "intelligence",
    type: "full",                           // "full", "half", "third", "pact", or null
    focus: "arcane focus",
    ritual_casting: true
  } | null,
  multiclass: {
    prerequisites: [                        // StatCondition format
      { "stat": "strength", "op": "gte", "value": 13 }
    ],
    proficiencies_gained: ["light-armor", "medium-armor", "shields"]
  },
  saving_throws: ["strength", "constitution"],
  starting_proficiencies: ["all-armor", "shields", "simple-weapons", "martial-weapons"],
  levels: [
    {
      level: 1,
      features: ["fighting-style", "second-wind"],
      spellcasting: null                    // or { cantrips_known: 3, spell_slots: [2,0,0,0,0,0,0,0,0] }
    },
    {
      level: 2,
      features: ["action-surge"],
      spellcasting: null
    },
    // ... through level 20
    {
      level: 3,
      features: [],
      subclass_level: true                  // player picks subclass at this level
    }
  ]
}
```

Effects array: proficiency choice effects for skill selection at creation.

### Subclass (`subclassDataSchema`)

```typescript
{
  parent_class: "bard",                     // slug of parent class
  flavor_label: "Bard College",             // display label for the subclass category
  description: "...",
  levels: [
    {
      level: 3,
      features: ["bonus-proficiencies", "cutting-words"]
    },
    {
      level: 6,
      features: ["additional-magical-secrets"]
    }
    // ... subclass feature levels only (not all 20)
  ],
  spells: []                                // subclass-granted spell slugs (if any)
}
```

### Background (`backgroundDataSchema`)

```typescript
{
  feature: {
    name: "Shelter of the Faithful",
    description: "..."
  },
  personality_traits: [                     // 8 options, player picks 2
    "I idolize a hero of my faith...",
    "I can find common ground between..."
  ],
  ideals: [                                 // 6 options, player picks 1
    { text: "Tradition. The ancient traditions...", alignment: "Lawful" },
    { text: "Charity. I always try to help...", alignment: "Good" }
  ],
  bonds: [                                  // 6 options, player picks 1
    "I would die to recover an ancient relic...",
    "I will someday get revenge on the corrupt..."
  ],
  flaws: [                                  // 6 options, player picks 1
    "I judge others harshly...",
    "I put too much trust in those who wield power..."
  ]
}
```

Effects array: skill proficiency grants, language/tool choice effects, equipment grants.

### Feat (`featDataSchema`)

```typescript
{
  description: "...",
  prerequisites: [                          // StatCondition format, empty for no prereqs
    { "stat": "strength", "op": "gte", "value": 13 }
  ]
}
```

Effects array: mechanical effects for stat bonuses, grant effects for proficiencies, narrative effects for non-mechanical benefits.

### Spell (`spellDataSchema`)

```typescript
{
  level: 3,                                 // 0 for cantrips
  school: "evocation",                      // magic school slug
  casting_time: "1 action",
  range: "150 feet",
  components: ["V", "S", "M"],
  material: "A tiny ball of bat guano and sulfur",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  description: "...",
  higher_level: "When you cast this spell using a spell slot of 4th level or higher...",
  damage: {                                 // null for non-damage spells
    type: "fire",
    dice_at_slot_level: {
      "3": "8d6", "4": "9d6", "5": "10d6", "6": "11d6",
      "7": "12d6", "8": "13d6", "9": "14d6"
    }
  } | null,
  heal_at_slot_level: null,                 // for healing spells
  dc: {                                     // null if no save
    type: "dexterity",
    success: "half"                         // "half", "none", "other"
  } | null,
  area_of_effect: {                         // null if no AoE
    type: "sphere",
    size: 20
  } | null,
  classes: ["sorcerer", "wizard"],          // class slugs
  subclasses: ["lore", "fiend"]             // subclass slugs
}
```

### Weapon (`weaponDataSchema`)

```typescript
{
  weapon_category: "Martial",               // "Simple" or "Martial"
  weapon_range: "Melee",                    // "Melee" or "Ranged"
  cost: { quantity: 15, unit: "gp" },
  weight: 3,
  damage: {
    dice: "1d8",
    type: "slashing"
  },
  range: { normal: 5 } | null,             // null for melee without thrown
  properties: ["versatile"],                // weapon property slugs
  two_handed_damage: {                      // null if not versatile
    dice: "1d10",
    type: "slashing"
  } | null
}
```

### Armor (`armorDataSchema`)

```typescript
{
  armor_category: "Heavy",                  // "Light", "Medium", "Heavy", "Shield"
  cost: { quantity: 75, unit: "gp" },
  weight: 65,
  armor_class: {
    base: 16,
    dex_bonus: false,
    max_bonus: null                         // null = unlimited, number = cap
  },
  str_minimum: 13,                          // 0 if none
  stealth_disadvantage: true
}
```

### General Equipment (`itemDataSchema`)

```typescript
{
  equipment_category: "Adventuring Gear",   // category name
  cost: { quantity: 5, unit: "gp" } | null,
  weight: 1 | null,
  description: "..."
}
```

### Magic Item (`magicItemDataSchema`)

```typescript
{
  rarity: "Uncommon",                       // Common, Uncommon, Rare, Very Rare, Legendary, Artifact
  description: "...",
  equipment_category: "Armor",              // base item category (if applicable)
}
```

Effects array: narrative effects for magic item properties (most are too complex for structured effects at this stage).

### Trait (`traitDataSchema`)

```typescript
{
  description: "...",
  races: ["elf", "half-elf"],               // which races have this trait
  subraces: ["high-elf"]                    // which subraces have this trait
}
```

Effects array: proficiency grants, choice effects (for traits like "Dwarven Weapon Training" that grant specific weapon proficiencies), narrative effects for complex abilities (Fey Ancestry, Trance, etc.).

### Language (`languageDataSchema`)

```typescript
{
  type: "Standard",                         // "Standard" or "Exotic"
  script: "Elvish",                         // writing system name, or null
  typical_speakers: ["Elves"],              // race names
  description: "..."
}
```

### Proficiency (`proficiencyDataSchema`)

```typescript
{
  proficiency_type: "skill",                // "skill", "armor", "weapon", "tool", "saving_throw"
  reference: "acrobatics",                  // slug of the linked skill/item/ability
  classes: ["rogue", "bard"],               // class slugs that grant this
  races: ["elf"]                            // race slugs that grant this
}
```

### Feature (`featureDataSchema`)

```typescript
{
  class: "wizard",                          // which class this belongs to
  subclass: null,                           // or subclass slug
  level: 2,                                 // at what level it's gained
  description: "..."
}
```

Effects array: mechanical effects where mappable, narrative effects for complex features.

---

## Import Script

### Architecture

Single script `scripts/import-srd.ts` with three stages:

1. **Fetch** — Pull raw JSON from each API endpoint, save to `data/srd-2014/raw/` (gitignored). Uses the list endpoint to get all slugs, then fetches each individual entry.

2. **Transform** — Per-content-type transformer functions in `scripts/transformers/` read raw JSON and produce `ContentDefinition` objects. Each transformer:
   - Maps API fields to our data schema
   - Converts mechanical data (ability bonuses, proficiencies, speed) to structured effects
   - Validates output against the content-type Zod schema
   - Logs warnings for fields that couldn't be mapped

3. **Load** — Insert transformed content into `content_definitions` via Supabase client. Uses upsert on `(system_id, content_type, slug, owner_id)` so re-running is idempotent. All entries get `scope: "platform"`, `source: "srd"`, `owner_id: null`.

### Import Order (dependency-aware)

1. Traits (~30) — referenced by races
2. Languages (~16) — referenced by race choices
3. Proficiencies (~90) — referenced by classes, races, backgrounds
4. Races + Subraces (~13)
5. Features (~370) — referenced by class level tables
6. Classes + Subclasses (~24)
7. Backgrounds (~1, SRD only has Acolyte)
8. Feats (~1, SRD only has Grappler)
9. Spells (~300+)
10. Equipment — weapons, armor, gear (~230)
11. Magic Items (~360)

### File Structure

```
scripts/
  import-srd.ts                   # Main entry — orchestrates fetch/transform/load
  transformers/
    races.ts                      # Race + subrace transformer
    classes.ts                    # Class + subclass + features transformer
    spells.ts                     # Spell transformer
    equipment.ts                  # Weapon, armor, general gear transformer
    backgrounds.ts                # Background transformer
    feats.ts                      # Feat transformer
    traits.ts                     # Trait transformer
    magic-items.ts                # Magic item transformer
    languages.ts                  # Language transformer
    proficiencies.ts              # Proficiency transformer
    common.ts                     # Shared: API fetch, slug normalization, effect builders
lib/
  types/
    effects.ts                    # Updated: add ChoiceEffect to Effect union
    taxonomies.ts                 # New: damage types, magic schools, weapon properties, etc.
  schemas/
    effects.ts                    # Updated: add choiceEffectSchema to effectSchema union
    content-types/
      index.ts                    # Schema registry: content_type string → Zod schema
      race.ts                     # raceDataSchema
      class.ts                    # classDataSchema
      subclass.ts                 # subclassDataSchema
      background.ts               # backgroundDataSchema
      feat.ts                     # featDataSchema
      spell.ts                    # spellDataSchema
      weapon.ts                   # weaponDataSchema
      armor.ts                    # armorDataSchema
      item.ts                     # itemDataSchema
      magic-item.ts               # magicItemDataSchema
      trait.ts                    # traitDataSchema
      feature.ts                  # featureDataSchema
      language.ts                 # languageDataSchema
      proficiency.ts              # proficiencyDataSchema
      subrace.ts                  # subraceDataSchema
data/
  srd-2014/
    raw/                          # Cached API responses (gitignored)
tests/
  schemas/
    content-types.test.ts         # Validate all content-type schemas
  transformers/
    races.test.ts                 # Verify race transformer output
    spells.test.ts                # Verify spell transformer output
    classes.test.ts               # Verify class transformer output
    equipment.test.ts             # Verify equipment transformer output
```

---

## Effect Mapping Strategy

For each content type, the transformer converts API data to our effects array:

| API Data | Effect Type | Example |
|---|---|---|
| ability_bonuses | mechanical (add) | `{type: "mechanical", stat: "dexterity", op: "add", value: 2}` |
| speed | mechanical (set) | `{type: "mechanical", stat: "movement_speed", op: "set", value: 30}` |
| size | mechanical (set) | `{type: "mechanical", stat: "size", op: "set", value: "Medium"}` |
| skill proficiency grants | grant | `{type: "grant", stat: "insight", value: "proficient"}` |
| saving throw proficiency | grant | `{type: "grant", stat: "save_strength", value: "proficient"}` |
| proficiency choices | choice | `{type: "choice", choose: 2, from: [...], grant_type: "skill_proficiency", choice_id: "..."}` |
| language choices | choice | `{type: "choice", choose: 2, from: "all_languages", grant_type: "language", choice_id: "..."}` |
| complex traits (Fey Ancestry, etc.) | narrative | `{type: "narrative", text: "You have advantage on saving throws against being charmed...", tag: "Racial Trait"}` |
| background feature | narrative | `{type: "narrative", text: "As an acolyte, you command respect...", tag: "Background Feature"}` |
| magic item properties | narrative | `{type: "narrative", text: "Any critical hit against you becomes a normal hit", tag: "Magic Item"}` |

---

## What This Sub-Project Delivers

1. **`choice` effect type** — new effect in types and Zod schemas, with `choice_id` for reversal support
2. **Taxonomy constants** — damage types, magic schools, weapon properties, creature sizes, armor/weapon categories
3. **16 content-type Zod schemas** — validating the `data` JSONB for each content type
4. **Import script with 10 transformer modules** — fetches from dnd5eapi.co, transforms, loads via Supabase
5. **~1,100+ SRD content entries** in `content_definitions` for `dnd-5e-2014`
6. **Tests** — for content-type schemas and key transformers (races, classes, spells, equipment)

## What This Sub-Project Does NOT Deliver

- Character builder UI or creation flow (sub-project 3)
- Database table changes (existing tables handle everything)
- Character sheet rendering
- 2024 SRD content (later sub-project)
- Full mechanical automation of complex traits/features (narrative effects used as placeholder)

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Data source | dnd5eapi.co REST API | Structured JSON, MIT license, 2014 SRD complete |
| Content data schema location | Zod schemas in code, not in system schema | System schema defines character sheet structure; content shapes are code concerns |
| Choice representation | New `choice` effect type with `choice_id` | Keeps all content grants in the effects array; choice_id enables reversal |
| Complex trait handling | Narrative effects with full text | Most traits (Fey Ancestry, Trance) don't map to simple stat mods; narrative preserves info for later enrichment |
| Import approach | Script with cached raw JSON + per-type transformers | One-time seed; cached raw data allows re-transform without API hits |
| Multiclass support | Class data includes prerequisites + gained proficiencies | Uses existing StatCondition format for prereqs; separate proficiency list for multiclass grants |
| Spell slot progression | Embedded in class level table | Spellcasting type (full/half/third/pact) on class enables multiclass spell slot calculation |
