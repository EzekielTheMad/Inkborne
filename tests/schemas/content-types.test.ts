import { describe, it, expect } from "vitest";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { subraceDataSchema } from "@/lib/schemas/content-types/subrace";
import { traitDataSchema } from "@/lib/schemas/content-types/trait";
import { languageDataSchema } from "@/lib/schemas/content-types/language";
import { proficiencyDataSchema } from "@/lib/schemas/content-types/proficiency";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { getContentTypeSchema } from "@/lib/schemas/content-types/index";
import { classDataSchema } from "@/lib/schemas/content-types/class";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import { backgroundDataSchema } from "@/lib/schemas/content-types/background";
import { featDataSchema } from "@/lib/schemas/content-types/feat";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import { weaponDataSchema } from "@/lib/schemas/content-types/weapon";
import { armorDataSchema } from "@/lib/schemas/content-types/armor";
import { itemDataSchema } from "@/lib/schemas/content-types/item";
import { magicItemDataSchema } from "@/lib/schemas/content-types/magic-item";

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
      feature: { name: "Shelter of the Faithful", description: "As an acolyte, you command respect..." },
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

describe("Spell Data Schema", () => {
  it("validates a damage spell (Fireball)", () => {
    const result = spellDataSchema.safeParse({
      level: 3, school: "evocation", casting_time: "1 action", range: "150 feet",
      components: ["V", "S", "M"], material: "A tiny ball of bat guano and sulfur",
      duration: "Instantaneous", concentration: false, ritual: false,
      description: "A bright streak flashes from your pointing finger...",
      higher_level: "When you cast this spell using a spell slot of 4th level or higher...",
      damage: { type: "fire", dice_at_slot_level: { "3": "8d6", "4": "9d6", "5": "10d6" } },
      heal_at_slot_level: null,
      dc: { type: "dexterity", success: "half" },
      area_of_effect: { type: "sphere", size: 20 },
      classes: ["sorcerer", "wizard"], subclasses: ["fiend"],
    });
    expect(result.success).toBe(true);
  });

  it("validates a cantrip", () => {
    const result = spellDataSchema.safeParse({
      level: 0, school: "evocation", casting_time: "1 action", range: "120 feet",
      components: ["V", "S"], duration: "Instantaneous", concentration: false, ritual: false,
      description: "A beam of crackling energy streaks...",
      damage: { type: "force", dice_at_slot_level: { "0": "1d10" } },
      dc: null, area_of_effect: null,
      classes: ["sorcerer", "wizard"], subclasses: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Weapon Data Schema", () => {
  it("validates a melee weapon", () => {
    const result = weaponDataSchema.safeParse({
      weapon_category: "Martial", weapon_range: "Melee",
      cost: { quantity: 15, unit: "gp" }, weight: 3,
      damage: { dice: "1d8", type: "slashing" }, range: null,
      properties: ["versatile"],
      two_handed_damage: { dice: "1d10", type: "slashing" },
    });
    expect(result.success).toBe(true);
  });
});

describe("Armor Data Schema", () => {
  it("validates heavy armor", () => {
    const result = armorDataSchema.safeParse({
      armor_category: "Heavy", cost: { quantity: 75, unit: "gp" }, weight: 65,
      armor_class: { base: 16, dex_bonus: false, max_bonus: null },
      str_minimum: 13, stealth_disadvantage: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("Item Data Schema", () => {
  it("validates general equipment", () => {
    const result = itemDataSchema.safeParse({
      equipment_category: "Adventuring Gear",
      cost: { quantity: 5, unit: "gp" }, weight: 1,
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
