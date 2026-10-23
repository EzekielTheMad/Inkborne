import { describe, expect, it } from "vitest";
import { referenceOptions, startingEquipmentText } from "@/scripts/transformers/api-options";
import { buildContentEntry } from "@/scripts/transformers/common";
import { transformTraitEntry } from "@/scripts/transformers/traits";
import { transformRaceEntry } from "@/scripts/transformers/races";
import { transformFeatureEntry } from "@/scripts/transformers/features";
import { transformBackgroundEntry } from "@/scripts/transformers/backgrounds";
import { SUBCLASS_LEVELS, transformClassEntry } from "@/scripts/transformers/classes";
import { validateSrdCatalog } from "@/scripts/transformers/validate-catalog";
import { buildInventoryGrants, parseEquipmentGroups } from "@/lib/builder/equipment-choices";

describe("real SRD catalog import metadata", () => {
  it("preserves nested Monk tool-or-instrument options as one choose-one union", () => {
    const options = referenceOptions({ choose: 1, from: { options: [
      { choice: { choose: 1, from: { options: [{ item: { index: "smiths-tools", name: "Smith's Tools" } }] } } },
      { choice: { choose: 1, from: { options: [{ item: { index: "flute", name: "Flute" } }] } } },
    ] } });
    expect(options.map(option => option.index)).toEqual(["smiths-tools", "flute"]);
    expect(() => referenceOptions({ choose: 1, from: { options: [
      { choice: { choose: 2, from: { options: [{ item: { index: "flute", name: "Flute" } }] } } },
    ] } })).toThrow("Unsupported SRD reference-choice option");
  });

  it("keeps fixed equipment and counted bundles in the shipped award grammar", () => {
    const text = startingEquipmentText([{ equipment: { index: "spellbook", name: "Spellbook" }, quantity: 1 }], [{
      choose: 1, from: { options: [
        { items: [{ of: { index: "crossbow-light", name: "Crossbow, light" }, count: 1 }, { of: { index: "crossbow-bolt", name: "Crossbow bolt" }, count: 20 }] },
        { choice: { choose: 2, from: { equipment_category: { index: "martial-weapons", name: "Martial Weapons" } } } },
      ] },
    }]);
    const groups = parseEquipmentGroups({ classText: text });
    expect(groups[0].options[0].items).toEqual([
      { kind: "concrete", name: "light crossbow", quantity: 1 },
      { kind: "concrete", name: "crossbow bolt", quantity: 20 },
    ]);
    expect(groups[0].options[1].items).toMatchObject([{ kind: "category", count: 2 }]);
    expect(groups[1].options[0].items).toEqual([{ kind: "concrete", name: "spellbook", quantity: 1 }]);
  });

  it("restores complete Acolyte SRD equipment and awards its gold once", () => {
    const background = transformBackgroundEntry({ index: "acolyte", name: "Acolyte", starting_proficiencies: [],
      starting_equipment: [{ equipment: { index: "clothes-common", name: "Clothes, common" }, quantity: 1 }, { equipment: { index: "pouch", name: "Pouch" }, quantity: 1 }],
      starting_equipment_options: [{ choose: 1, from: { equipment_category: { index: "holy-symbols", name: "Holy Symbols" } } }],
      starting_gold: { quantity: 15, unit: "gp" }, feature: { name: "Shelter", desc: ["Shelter"] },
      personality_traits: { choose: 2, from: { options: [] } }, ideals: { choose: 1, from: { options: [] } },
      bonds: { choose: 1, from: { options: [] } }, flaws: { choose: 1, from: { options: [] } } });
    expect(background.data.equipment).toContain("5 sticks of incense");
    expect(background.data.equipment).toContain("pouch containing 15 gp");
    const groups = parseEquipmentGroups({ backgroundText: background.data.equipment as string });
    const selections = Object.fromEntries(groups.map(group => [group.key, "a"]));
    const picks = { "background:0:a:0": "amulet" };
    const award = buildInventoryGrants(groups, { selections, picks, confirmed: false }, []);
    expect(award.currency).toEqual({ gp: 15 });
    expect(award.items.some(item => /15 gp/.test(item.name))).toBe(false);
    const custom = transformBackgroundEntry({ index: "custom-test", name: "Custom Test", starting_proficiencies: [], starting_equipment: [{ equipment: { index: "pouch", name: "Pouch" }, quantity: 1 }], starting_equipment_options: [],
      starting_gold: { quantity: 15, unit: "gp" }, feature: { name: "Shelter", desc: ["Shelter"] },
      personality_traits: { choose: 2, from: { options: [] } }, ideals: { choose: 1, from: { options: [] } }, bonds: { choose: 1, from: { options: [] } }, flaws: { choose: 1, from: { options: [] } } });
    expect(custom.data.equipment).toBe("1 Pouch containing 15 gp");
  });

  it("retains the High Elf cantrip choice and actual casting ability", () => {
    const trait = transformTraitEntry({ index: "high-elf-cantrip", name: "Cantrip", desc: ["Choose a wizard cantrip."], races: [], subraces: [{ index: "high-elf", name: "High Elf" }], proficiencies: [],
      trait_specific: { spell_options: { choose: 1, from: { options: [{ item: { index: "light", name: "Light" } }, { item: { index: "mage-hand", name: "Mage Hand" } }] } } } });
    expect(trait.effects).toContainEqual({ type: "choice", choose: 1, from: ["light", "mage-hand"], grant_type: "spell", choice_id: "high-elf-cantrip-spell-choice" });
    expect(trait.effects).toContainEqual({ type: "grant", stat: "spellcasting_ability", value: "intelligence" });
    const tiefling = buildContentEntry("trait", "infernal-legacy", "Infernal Legacy", { description: "You know thaumaturgy." });
    expect(tiefling.effects).toContainEqual({ type: "grant", stat: "spell", value: "thaumaturgy" });
    expect(tiefling.effects).toContainEqual({ type: "grant", stat: "spellcasting_ability", value: "charisma" });
  });

  it("keeps Half-Elf chosen +1 bonuses separate from its fixed +2 CHA", () => {
    const input = { index: "half-elf", name: "Half-Elf", speed: 30, size: "Medium", size_description: "Medium", age: "", alignment: "", language_desc: "", traits: [], subraces: [], languages: [], starting_proficiencies: [],
      ability_bonuses: [{ ability_score: { index: "cha", name: "CHA" }, bonus: 2 }],
      ability_bonus_options: { choose: 2, from: { options: ["str", "dex", "con", "int", "wis"].map(index => ({ ability_score: { index }, bonus: 1 })) } } };
    const race = transformRaceEntry(input);
    expect(race.data.scores).toBeUndefined();
    expect(race.data.ability_score_representation).toEqual({ version: 1, mode: "effects" });
    expect(race.effects).toContainEqual({ type: "mechanical", stat: "charisma", op: "add", value: 2 });
    expect(race.effects).toContainEqual({ type: "choice", choose: 2, from: ["strength", "dexterity", "constitution", "intelligence", "wisdom"], grant_type: "ability_bonus", choice_id: "half-elf-ability-bonus-choice" });
    expect(() => transformRaceEntry({ ...input, ability_bonus_options: { choose: 1, from: { options: [{ ability_score: { index: "str" }, bonus: 2 }] } } })).toThrow("Unsupported nonuniform SRD ability bonus");
  });

  it("preserves actual fighting-style child references and conditional defense", () => {
    const feature = transformFeatureEntry({ index: "fighter-fighting-style", name: "Fighting Style", class: { index: "fighter", name: "Fighter" }, level: 1, desc: ["Choose a style."], prerequisites: [],
      feature_specific: { subfeature_options: { choose: 1, from: { options: [{ item: { index: "fighter-fighting-style-defense", name: "Defense" } }] } } } });
    expect(feature.data.choices).toEqual([{ name: "Fighting Style", count: 1, options: ["fighter-fighting-style-defense"] }]);
    expect(transformFeatureEntry({ index: "domain-spells-1", name: "Domain Spells", class: { index: "cleric", name: "Cleric" }, level: 1, desc: ["Domain spells."], prerequisites: [] }).data.feature_type).toBe("passive");
    const defense = buildContentEntry("feature", "fighter-fighting-style-defense", "Defense", {});
    expect(defense.effects).toContainEqual({ type: "mechanical", stat: "armor_class", op: "add", value: 1, condition: { field: "equipped_armor", op: "neq", value: "none" } });
  });

  it("sets explicit subclass prompts at the real class level", () => {
    expect(SUBCLASS_LEVELS).toMatchObject({ cleric: 1, sorcerer: 1, warlock: 1, druid: 2, wizard: 2, fighter: 3 });
    const cleric = transformClassEntry({ index: "cleric", name: "Cleric", hit_die: 8, proficiency_choices: [], proficiencies: [], saving_throws: [], starting_equipment: [], starting_equipment_options: [], subclasses: [], multi_classing: { prerequisites: [], proficiencies: [] } },
      [{ level: 1, ability_score_bonuses: 0, prof_bonus: 2, features: [], class_specific: {} }]);
    expect(cleric.data.levels).toMatchObject([{ level: 1, subclass_level: true }]);
    expect((cleric.data.spellcastingKnown as { prepared: boolean }).prepared).toBe(true);
  });

  it("refuses malformed data and missing spell dependencies before publication", () => {
    expect(() => validateSrdCatalog([{ content_type: "race", slug: "bad", name: "Bad", data: {}, effects: [] }])).toThrow("Invalid SRD race/bad");
    expect(() => validateSrdCatalog([{ content_type: "trait", slug: "infernal-legacy", name: "Infernal Legacy", data: { description: "You know thaumaturgy." }, effects: [{ type: "grant", stat: "spell", value: "thaumaturgy" }] }])).toThrow("Missing SRD dependency: trait/infernal-legacy -> spell/thaumaturgy");
  });
});
