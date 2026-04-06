import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
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
});
