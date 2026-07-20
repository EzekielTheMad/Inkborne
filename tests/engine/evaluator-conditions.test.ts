import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";

const schema: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "intelligence", name: "Intelligence", abbr: "INT" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
    { slug: "charisma", name: "Charisma", abbr: "CHA" },
  ],
  proficiency_levels: [],
  derived_stats: [
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
    { slug: "movement_speed", name: "Speed", base: 30 },
  ],
  content_types: [],
  skills: [],
  resources: [],
  currencies: [],
  creation_steps: [],
  sheet_sections: [],
};

const baseStats = {
  strength: 16,
  dexterity: 14,
  constitution: 14,
  intelligence: 10,
  wisdom: 12,
  charisma: 8,
};

describe("conditional effects", () => {
  it("applies unconditional effect (no condition field)", () => {
    const effects: Effect[] = [
      { type: "mechanical", stat: "armor_class", op: "add", value: 1 },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {});
    // AC = 10 + mod(14) + 1 = 10 + 2 + 1 = 13
    expect(result.computed.armor_class).toBe(13);
  });

  it("applies effect when condition is met", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 1,
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "medium",
    });
    expect(result.computed.armor_class).toBe(13);
  });

  it("skips effect when condition is NOT met", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 1,
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "none",
    });
    expect(result.computed.armor_class).toBe(12);
  });

  it("skips effect when state is empty and default fails condition", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 1,
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ];
    // No state → defaults to equipped_armor="none" → condition fails
    const result = evaluate(baseStats, effects, schema);
    expect(result.computed.armor_class).toBe(12);
  });
});

describe("AC best-of with tagged formulas", () => {
  it("picks the best AC formula over schema default", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "10 + mod(dexterity) + mod(constitution)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "none",
    });
    // Schema default: 10 + mod(14) = 12
    // Barbarian formula: 10 + 2 + 2 = 14
    // Best of: 14
    expect(result.computed.armor_class).toBe(14);
  });

  it("uses schema default when formula condition fails", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "10 + mod(dexterity) + mod(constitution)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "medium",
    });
    expect(result.computed.armor_class).toBe(12);
  });

  it("applies additive bonus on top of best AC formula", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "10 + mod(dexterity) + mod(constitution)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
      // Shield bonus (unconditional add, no tag)
      { type: "mechanical", stat: "armor_class", op: "add", value: 2 },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "none",
    });
    // Best formula: 14, then +2 shield = 16
    expect(result.computed.armor_class).toBe(16);
  });

  it("picks the best among multiple AC formulas", () => {
    const effects: Effect[] = [
      // Barbarian: 10 + DEX + CON = 14
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "10 + mod(dexterity) + mod(constitution)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
      // Draconic: 13 + DEX = 15
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "13 + mod(dexterity)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "none",
    });
    // Best of 14 vs 15 = 15
    expect(result.computed.armor_class).toBe(15);
  });
});

describe("conditional speed bonus", () => {
  it("applies speed bonus when condition met", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "movement_speed",
        op: "add",
        value: 10,
        condition: { field: "equipped_armor", op: "neq", value: "heavy" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "light",
    });
    expect(result.computed.movement_speed).toBe(40);
  });

  it("skips speed bonus when wearing heavy armor", () => {
    const effects: Effect[] = [
      {
        type: "mechanical",
        stat: "movement_speed",
        op: "add",
        value: 10,
        condition: { field: "equipped_armor", op: "neq", value: "heavy" },
      },
    ];
    const result = evaluate(baseStats, effects, schema, undefined, {
      equipped_armor: "heavy",
    });
    expect(result.computed.movement_speed).toBe(30);
  });
});
