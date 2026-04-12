import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import type { StructuredSources } from "@/lib/engine/evaluator";
import type { Effect } from "@/lib/types/effects";
import type { SystemSchemaDefinition } from "@/lib/types/system";

const MINIMAL_SCHEMA: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
  ],
  proficiency_levels: [
    { slug: "none", name: "Not Proficient", multiplier: 0 },
    { slug: "proficient", name: "Proficient", multiplier: 1 },
  ],
  derived_stats: [
    { slug: "proficiency_bonus", name: "Proficiency Bonus", formula: "floor((level - 1) / 4) + 2" },
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
    { slug: "initiative", name: "Initiative", formula: "mod(dexterity)" },
    { slug: "movement_speed", name: "Speed", base: 30 },
  ],
  skills: [{ slug: "athletics", name: "Athletics", ability: "strength" }],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [{ step: 1, type: "species", label: "Choose Species" }],
  sheet_sections: [{ slug: "header", label: "Header" }],
};

describe("evaluate", () => {
  it("computes derived stats from base stats", () => {
    const baseStats = { strength: 16, dexterity: 14, constitution: 12, wisdom: 10, level: 5 };
    const effects: Effect[] = [];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.computed.proficiency_bonus).toBe(3);
    expect(result.computed.armor_class).toBe(12);
    expect(result.computed.initiative).toBe(2);
    expect(result.computed.movement_speed).toBe(30);
  });

  it("applies static add effects", () => {
    const baseStats = { strength: 16, dexterity: 14, constitution: 12, wisdom: 10, level: 5 };
    const effects: Effect[] = [
      { type: "mechanical", stat: "dexterity", op: "add", value: 2 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.computed.armor_class).toBe(13);
    expect(result.computed.initiative).toBe(3);
  });

  it("applies set before add", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "mechanical", stat: "strength", op: "add", value: 2 },
      { type: "mechanical", stat: "strength", op: "set", value: 15 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.stats.strength).toBe(17);
  });

  it("applies movement speed bonus", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "mechanical", stat: "movement_speed", op: "add", value: 10 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.computed.movement_speed).toBe(40);
  });

  it("collects narrative effects without modifying stats", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "narrative", text: "50% discount at org HQ", tag: "Perk" },
      { type: "mechanical", stat: "strength", op: "add", value: 1 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.narratives).toHaveLength(1);
    expect(result.narratives[0].text).toBe("50% discount at org HQ");
    expect(result.stats.strength).toBe(11);
  });

  it("collects grant effects", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "grant", stat: "athletics", value: "proficient" },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].stat).toBe("athletics");
    expect(result.grants[0].value).toBe("proficient");
  });

  // ------- Phase 1 structured data tests -------

  it("returns sensible defaults when sources is undefined", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const result = evaluate(baseStats, [], MINIMAL_SCHEMA);

    expect(result.speed).toEqual({ walk: 30 });
    expect(result.vision).toEqual([]);
    expect(result.dmgres).toEqual([]);
    expect(result.savetxt).toEqual({ adv_vs: [], immune: [] });
    expect(result.attacks).toBe(1);
    expect(result.improvements).toBe(false);
  });

  it("applies race scores as ability bonuses", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const sources: StructuredSources = {
      raceData: {
        scores: [0, 2, 0, 0, 1, 0], // +2 DEX, +1 WIS (Elf-like)
        speed_detail: { walk: 30 },
      },
      level: 1,
    };

    const result = evaluate(baseStats, [], MINIMAL_SCHEMA, sources);

    // DEX should be 12 (10 + 2), WIS should be 11 (10 + 1)
    expect(result.stats.dexterity).toBe(12);
    expect(result.stats.wisdom).toBe(11);
    // Derived stats should reflect the DEX bonus
    expect(result.computed.armor_class).toBe(11); // 10 + mod(12) = 10 + 1
    expect(result.computed.initiative).toBe(1);
  });

  it("aggregates speed from race and features additively", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const sources: StructuredSources = {
      raceData: {
        speed_detail: { walk: 30 },
      },
      featureData: [
        { speed: { fly: 30 } },
        { speed: { walk: 10 } }, // e.g., Unarmored Movement
      ],
      level: 1,
    };

    const result = evaluate(baseStats, [], MINIMAL_SCHEMA, sources);

    expect(result.speed).toEqual({ walk: 40, fly: 30 });
  });

  it("deduplicates vision by type keeping highest range", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const sources: StructuredSources = {
      raceData: {
        vision: [{ type: "darkvision", range: 60 }],
      },
      featureData: [
        { vision: [{ type: "darkvision", range: 120 }] }, // Superior darkvision
        { vision: [{ type: "blindsight", range: 10 }] },
      ],
      level: 1,
    };

    const result = evaluate(baseStats, [], MINIMAL_SCHEMA, sources);

    expect(result.vision).toHaveLength(2);
    const dv = result.vision.find((v) => v.type === "darkvision");
    expect(dv?.range).toBe(120);
    const bs = result.vision.find((v) => v.type === "blindsight");
    expect(bs?.range).toBe(10);
  });

  it("unions damage resistances from race and features", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const sources: StructuredSources = {
      raceData: {
        dmgres: ["poison"],
      },
      featureData: [
        { dmgres: ["fire"] },
        { dmgres: ["poison", "cold"] }, // poison duplicate
      ],
      level: 1,
    };

    const result = evaluate(baseStats, [], MINIMAL_SCHEMA, sources);

    expect(result.dmgres).toHaveLength(3);
    expect(result.dmgres).toContain("poison");
    expect(result.dmgres).toContain("fire");
    expect(result.dmgres).toContain("cold");
  });

  it("merges save text from race and features", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const sources: StructuredSources = {
      raceData: {
        savetxt: { adv_vs: ["poison"], immune: [] },
      },
      featureData: [
        { savetxt: { adv_vs: ["frightened"], immune: ["disease"] } },
      ],
      level: 1,
    };

    const result = evaluate(baseStats, [], MINIMAL_SCHEMA, sources);

    expect(result.savetxt.adv_vs).toContain("poison");
    expect(result.savetxt.adv_vs).toContain("frightened");
    expect(result.savetxt.immune).toContain("disease");
  });

  it("reads attacks from class data at current level", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 5 };
    const attacks = [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    const sources: StructuredSources = {
      classData: { attacks },
      level: 5,
    };

    const result = evaluate(baseStats, [], MINIMAL_SCHEMA, sources);

    expect(result.attacks).toBe(2);
  });

  it("reads improvements from class data at current level", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 4 };
    const improvements = [false, false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, true, false];
    const sources: StructuredSources = {
      classData: { improvements },
      level: 4,
    };

    const result = evaluate(baseStats, [], MINIMAL_SCHEMA, sources);

    expect(result.improvements).toBe(true);
  });

  it("race scores combine with existing mechanical effects", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "mechanical", stat: "dexterity", op: "add", value: 1 }, // +1 from some other source
    ];
    const sources: StructuredSources = {
      raceData: {
        scores: [0, 2, 0, 0, 0, 0], // +2 DEX from race
      },
      level: 1,
    };

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA, sources);

    // 10 (base) + 2 (race) + 1 (effect) = 13
    expect(result.stats.dexterity).toBe(13);
  });
});
