# MPMB vs Inkborne Schema Audit

**Date:** 2026-04-11
**Purpose:** Comprehensive comparison of MorePurpleMoreBetter D&D 5e data structures against Inkborne's current schemas to identify gaps for expansion.

---

## Phase Plan

### Phase 1: Character Sheet Accuracy (Current)
- Race ability score bonuses (scores)
- Feature action economy (action, usages, recovery)
- Feature per-level scaling (additional)
- Speed types (walk/fly/swim/climb/burrow + encumbered)
- Race/feature vision grants (darkvision, blindsight, etc.)
- Race/feature damage resistances
- Extra attack progression
- Ability score caps (scoresMaximum)

### Phase 2: Spell Management
- Spells known per level / prepared caster flag
- Spell list references (spellcastingList)
- Bonus spell grants (spellcastingBonus, spellcastingExtra)
- Spell modifications (spellChanges)
- Cantrip scaling (descriptionCantripDie)

### Phase 3: Homebrew & Full Automation
- Full feat mechanical effects (scores, speed, vision, dmgres, proficiencies, spellcasting)
- Background proficiency grants (skills, tools, languages)
- Class proficiency structure (primary vs secondary / multiclass split)
- Feature calcChanges system (atkCalc, atkAdd, spellCalc, spellAdd)
- Dynamic item creation (weaponOptions, armorOptions)
- Choice dependency chains
- Feature prerequisites (prereqeval)
- Variant backgrounds
- Weapon inheritance (baseWeapon)
- Companion/creature system
- Subclass category naming

---

## Detailed Audit by Content Type

### CLASSES

**Current schema:** hit_die, spellcasting (ability, type, focus, ritual_casting), multiclass (prerequisites, proficiencies_gained), saving_throws, starting_proficiencies, levels[] (level, features[], spellcasting, subclass_level, class_specific)

| MPMB Field | Description | Status | Phase |
|---|---|---|---|
| primaryAbility | Primary ability score string | GAP | 3 |
| abilitySave | Ability index for non-caster save DCs (e.g. Monk Ki) | GAP | 2 |
| improvements | Array of 20 booleans: which levels get ASI | GAP | 1 |
| skillstxt | Skill choice text with primary/secondary | GAP | 3 |
| toolProfs | Tool proficiency objects (primary/secondary) | GAP | 3 |
| armorProfs | Armor proficiency arrays (primary/secondary) | GAP | 3 |
| weaponProfs | Weapon proficiency arrays (primary/secondary) | GAP | 3 |
| equipment | Starting equipment text with options | GAP | 3 |
| subclasses | Subclass category name + key list | GAP | 3 |
| attacks | Array of 20 ints: attacks per action per level | GAP | 1 |
| spellcastingKnown | Cantrips array, spells array or "list", prepared bool | GAP | 2 |
| spellcastingList | Class + level range for spell list access | GAP | 2 |
| spellcastingExtra | Bonus spells granted at certain levels | GAP | 2 |

### RACES

**Current schema:** size, speed (single int), age_description, alignment_description, size_description, language_description, traits[], subraces[], languages[]

| MPMB Field | Description | Status | Phase |
|---|---|---|---|
| speed (object) | { walk: { spd, enc }, fly, swim, climb, burrow } | GAP | 1 |
| scores | Array of 6 ability score bonuses | GAP | 1 |
| scorestxt | Human-readable score description | GAP | 1 |
| height / weight | Height/weight descriptions | GAP | 3 |
| vision | Array of [type, range] | GAP | 1 |
| savetxt | { text[], adv_vs[] } | GAP | 1 |
| dmgres | Damage resistances array | GAP | 1 |
| skills | Skill proficiencies | GAP | 1 |
| skillstxt | Skill choice text | GAP | 1 |
| weaponProfs / toolProfs / armorProfs | Proficiency arrays | GAP | 1 |
| features (object) | Level-gated racial features with actions/usages/recovery | GAP | 1 |
| spellcastingAbility | Innate spellcasting ability | GAP | 2 |
| spellcastingBonus | Innate spells | GAP | 2 |

### FEATURES (cross-cutting — class features, racial features, feat effects)

**Current schema:** class, subclass, level, description, feature_type

| MPMB Field | Description | Status | Phase |
|---|---|---|---|
| action | Action economy: bonus action, reaction, action | GAP | 1 |
| usages | Per-level usage array or number | GAP | 1 |
| recovery | "short rest" / "long rest" / "dawn" / "day" | GAP | 1 |
| additional | Per-level scaling array (rage damage, sneak attack dice) | GAP | 1 |
| savetxt | { text[], immune[], adv_vs[] } | GAP | 1 |
| dmgres | Damage resistances array | GAP | 1 |
| scores | Ability score modifications | GAP | 1 |
| scoresMaximum | Ability score caps | GAP | 1 |
| vision | Vision grants | GAP | 1 |
| speed | Speed modifications by type | GAP | 1 |
| skills / weaponProfs / armorProfs / toolProfs | Proficiency grants | PARTIAL | 1 |
| languageProfs | Language grants | PARTIAL | 1 |
| extraAC | AC bonus definitions | GAP | 1 |
| spellcastingBonus | Bonus spell access | GAP | 2 |
| spellcastingAbility | Override spellcasting ability | GAP | 2 |
| spellcastingExtra | Extra known spells per level | GAP | 2 |
| calcChanges | Computed modifications (atkCalc, atkAdd, spellCalc) | GAP | 3 |
| addMod | Modifier additions (type, field, mod, text) | GAP | 3 |
| extraLimitedFeatures | Additional limited-use resources | GAP | 1 |
| weaponOptions / armorOptions | Dynamic item creation | GAP | 3 |
| creaturesAdd / companionCallback | Companion system | GAP | 3 |
| choices / extrachoices / extraTimes | Multi-selection system | PARTIAL | 3 |
| prereqeval | Feature prerequisite check | GAP | 3 |

### SPELLS

**Current schema:** level, school, casting_time, range, components, material, duration, concentration, ritual, description, higher_level, damage, heal_at_slot_level, dc, area_of_effect, classes, subclasses

| MPMB Field | Description | Status | Phase |
|---|---|---|---|
| descriptionFull | Complete rules text (vs abbreviated) | GAP | 2 |
| descriptionCantripDie | Cantrip scaling formula | GAP | 2 |
| dependencies | Spell prerequisite chain | GAP | 2 |
| rangeMetric | Metric range | GAP | 4 |
| nameShort / nameAlt | Name variants | GAP | 4 |

### FEATS

**Current schema:** description, prerequisites[] (StatCondition)

| MPMB Field | Description | Status | Phase |
|---|---|---|---|
| scores | Ability score bonuses | GAP | 3 |
| scoresMaximum | Ability score cap overrides | GAP | 3 |
| action / usages / recovery | Action economy and resource tracking | GAP | 3 |
| calcChanges | Attack/spell calc mods | GAP | 3 |
| spellcastingBonus | Spell grants | GAP | 3 |
| weaponProfs / armorProfs / toolProfs / skills | Proficiency grants | GAP | 3 |
| speed / vision / dmgres / savetxt | Stat modifications | GAP | 3 |
| extraAC | AC bonus | GAP | 3 |
| languageProfs | Language grants | GAP | 3 |
| extraLimitedFeatures | Limited-use resources | GAP | 3 |

### BACKGROUNDS

**Current schema:** feature (name, description), personality_traits[], ideals[], bonds[], flaws[]

| MPMB Field | Description | Status | Phase |
|---|---|---|---|
| skills | Skill proficiency array | GAP | 3 |
| gold | Starting gold amount | GAP | 3 |
| equipleft / equipright | Equipment grants | GAP | 3 |
| languageProfs | Language proficiency grants | GAP | 3 |
| toolProfs | Tool proficiency grants | GAP | 3 |
| lifestyle | Lifestyle level | GAP | 4 |
| variant | Variant background references | GAP | 3 |

### WEAPONS / ARMOR / GEAR

| MPMB Field | Description | Status | Phase |
|---|---|---|---|
| ability | Explicit ability modifier index | GAP | 3 |
| Extended weapon types | Natural, Cantrip, Spell, Improvised | GAP | 3 |
| monkweapon | Monk weapon flag | GAP | 3 |
| ammo | Ammunition type reference | GAP | 3 |
| baseWeapon | Parent weapon for variants | GAP | 3 |
| Ammunition schema | Full ammo model | GAP | 3 |
| Equipment packs | Pack definitions with contents | GAP | 3 |
| General gear schema | Adventuring gear model | GAP | 3 |

---

## Architectural Notes

1. **Effect system gap is structural.** MPMB uses `calcChanges` with JavaScript functions for conditional modifiers. Our Effect system is declarative (`{stat, op, value}`). Our Tier 3 scripts were designed for this but aren't implemented.

2. **Proficiencies need structure.** Currently flat string arrays. MPMB splits primary vs secondary (multiclass), tracks tool/weapon/armor separately with selection mechanics.

3. **Features are where most mechanics live.** MPMB features have 30+ possible fields. Our feature schema has 5. The feature schema is the single biggest expansion target.

4. **The feat schema is nearly empty.** Just description + prerequisites. No mechanical effects at all.

5. **Races need mechanical fields urgently.** Almost entirely descriptive text. Ability scores, proficiencies, resistances, vision, speed types all absent from the structured data.
