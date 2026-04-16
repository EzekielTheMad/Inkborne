import { describe, it, expect } from "vitest";
import { generateArmorEffects } from "@/lib/inventory/armor-effects";

describe("generateArmorEffects", () => {
  it("generates set effect for heavy armor (no DEX)", () => {
    const effects = generateArmorEffects({
      armor_category: "Heavy",
      armor_class: { base: 16, dex_bonus: false },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "16",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ]);
  });

  it("generates formula effect for light armor (full DEX)", () => {
    const effects = generateArmorEffects({
      armor_category: "Light",
      armor_class: { base: 11, dex_bonus: true },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "11 + mod(dexterity)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ]);
  });

  it("generates formula with max bonus for medium armor", () => {
    const effects = generateArmorEffects({
      armor_category: "Medium",
      armor_class: { base: 14, dex_bonus: true, max_bonus: 2 },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "14 + min(mod(dexterity), 2)",
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "neq", value: "none" },
      },
    ]);
  });

  it("generates +2 AC for shield", () => {
    const effects = generateArmorEffects({
      armor_category: "Shield",
      armor_class: { base: 2, dex_bonus: false },
    });
    expect(effects).toEqual([
      {
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 2,
      },
    ]);
  });

  it("returns empty array for null data", () => {
    expect(generateArmorEffects(null)).toEqual([]);
  });
});
