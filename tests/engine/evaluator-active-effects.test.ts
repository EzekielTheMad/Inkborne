import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";
import type { ActiveEffect } from "@/lib/types/active-effects";
import { collectActiveEffects } from "@/lib/active-effects/helpers";

/**
 * Integration-style proof of design §6.4: active effects compose into the
 * evaluate() input exactly like equipped-armor effects, and the evaluator
 * needs ZERO changes — conditions, ac_formula best-of, adds, maxes, and
 * roll-modifier stat slugs all behave through the existing pipeline.
 */

const schema: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbreviation: "STR" },
    { slug: "dexterity", name: "Dexterity", abbreviation: "DEX" },
    { slug: "constitution", name: "Constitution", abbreviation: "CON" },
    { slug: "intelligence", name: "Intelligence", abbreviation: "INT" },
    { slug: "wisdom", name: "Wisdom", abbreviation: "WIS" },
    { slug: "charisma", name: "Charisma", abbreviation: "CHA" },
  ],
  derived_stats: [
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
  ],
  content_types: [],
  creation_steps: [],
} as unknown as SystemSchemaDefinition;

const baseStats = {
  strength: 10,
  dexterity: 16, // mod +3
  constitution: 12,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

const NOW = new Date("2026-07-15T12:00:00.000Z");

const mkActive = (
  effects: Effect[],
  overrides: Partial<ActiveEffect> = {},
): ActiveEffect => ({
  id: "ae-1",
  name: "Test Effect",
  slug: "test-effect",
  source: "spell",
  content_id: null,
  effects,
  duration: { type: "minutes", value: 10 },
  concentration: false,
  applied_at: NOW.toISOString(),
  expires_at: null,
  ...overrides,
});

// Mirrors CharacterProvider: combined = [...allEffects, ...armor, ...active]
function evalWithActive(
  active: ActiveEffect[],
  state: Record<string, unknown>,
  baseEffects: Effect[] = [],
  now: Date = NOW,
) {
  const combined = [...baseEffects, ...collectActiveEffects(active, now)];
  return evaluate(baseStats, combined, schema, undefined, state);
}

describe("evaluator integration — active effects as appended Effect[]", () => {
  const mageArmor = mkActive(
    [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "13 + mod(dexterity)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      },
    ],
    {
      name: "Mage Armor",
      slug: "mage-armor",
      duration: { type: "hours", value: 8 },
      expires_at: "2026-07-15T20:00:00.000Z",
    },
  );

  it("Mage Armor raises AC only while unarmored (condition works live)", () => {
    // Unarmored: best-of(10+3, 13+3) = 16
    const unarmored = evalWithActive([mageArmor], { equipped_armor: "none" });
    expect(unarmored.computed.armor_class).toBe(16);

    // Armored: condition fails → schema default 13
    const armored = evalWithActive([mageArmor], { equipped_armor: "medium" });
    expect(armored.computed.armor_class).toBe(13);
  });

  it("a Shield-shaped add stacks on top of the best-of AC result", () => {
    const shield = mkActive(
      [{ type: "mechanical", stat: "armor_class", op: "add", value: 5 }],
      { id: "ae-2", name: "Shield", slug: "shield", duration: { type: "rounds", value: 1 } },
    );
    const result = evalWithActive([mageArmor, shield], {
      equipped_armor: "none",
    });
    // best-of 16, then +5 = 21
    expect(result.computed.armor_class).toBe(21);
  });

  it("a Barkskin-shaped max floors AC at 16", () => {
    const barkskin = mkActive(
      [{ type: "mechanical", stat: "armor_class", op: "max", value: 16 }],
      { id: "ae-3", name: "Barkskin", slug: "barkskin" },
    );
    // Base AC 13 → floored to 16
    const result = evalWithActive([barkskin], { equipped_armor: "none" });
    expect(result.computed.armor_class).toBe(16);
  });

  it("expired entries stop contributing", () => {
    const afterExpiry = new Date("2026-07-15T21:00:00.000Z");
    const result = evalWithActive(
      [mageArmor],
      { equipped_armor: "none" },
      [],
      afterExpiry,
    );
    expect(result.computed.armor_class).toBe(13); // schema default only
  });

  it("roll-modifier stat slugs accumulate harmlessly outside derived stats", () => {
    const bless = mkActive(
      [
        { type: "mechanical", stat: "roll_attack", op: "add", value: "1d4" },
        { type: "narrative", text: "Add a d4 to attacks and saves." },
      ],
      { id: "ae-4", name: "Bless", slug: "bless", concentration: true },
    );
    const result = evalWithActive([bless], {});
    // String values are treated as 0 by static application — no NaN, no crash,
    // and armor_class is untouched. The roll layer consumes these instead.
    expect(result.computed.armor_class).toBe(13);
    expect(Number.isNaN(result.stats.roll_attack ?? 0)).toBe(false);
    // The narrative half surfaces like any other narrative effect.
    expect(result.narratives.some((n) => n.text.includes("d4"))).toBe(true);
  });

  it("composes with base (class/race) effects like equipped armor does", () => {
    const baseEffects: Effect[] = [
      { type: "mechanical", stat: "dexterity", op: "add", value: 2 },
    ];
    const shieldOfFaith = mkActive(
      [{ type: "mechanical", stat: "armor_class", op: "add", value: 2 }],
      { id: "ae-5", name: "Shield of Faith", slug: "shield-of-faith" },
    );
    const result = evalWithActive([shieldOfFaith], {}, baseEffects);
    // dex 18 → mod +4; AC 10+4+2 = 16
    expect(result.computed.armor_class).toBe(16);
  });
});
