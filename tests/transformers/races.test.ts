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
