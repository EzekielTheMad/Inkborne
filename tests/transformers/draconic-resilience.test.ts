import { describe, expect, it } from "vitest";
import { subclassResilienceMechanics } from "@/scripts/transformers/classes";
import { buildContentEntry } from "@/scripts/transformers/common";
import { transformFeatureEntry } from "@/scripts/transformers/features";
import { evaluate } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { draconicLevels, draconicResilienceSource, draconicRoot } from "../fixtures/subclass-hit-points";

describe("genuine Draconic root mechanics", () => {
  it("publishes meaningful root HP/AC while leaving the original feature representation unchanged", () => {
    const source = structuredClone(draconicResilienceSource), before = JSON.stringify(source);
    const mechanics = subclassResilienceMechanics(draconicRoot, draconicLevels, source);
    const root = buildContentEntry("subclass", "draconic", "Draconic", {
      parent_class: "sorcerer", levels: draconicLevels, ...mechanics.data,
    }, mechanics.effects);
    expect(root.data.hit_points_bonus_per_class_level).toBe(1);
    expect(root.effects).toEqual([{ type: "mechanical", stat: "armor_class", op: "formula", expr: "13 + mod(dexterity)",
      tag: "ac_formula", condition: { field: "equipped_armor", op: "eq", value: "none" } }]);
    expect(transformFeatureEntry({ ...source, prerequisites: [] }).effects.every(effect => effect.type === "narrative")).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
  });
  it.each(["parent", "feature-parent", "subclass", "level", "prose", "manifest", "duplicate", "missing"])("fails closed when the genuine %s source changes", kind => {
    const source = structuredClone(draconicResilienceSource), root = structuredClone(draconicRoot), levels = structuredClone(draconicLevels);
    if (kind === "parent") root.class.index = "wizard";
    if (kind === "feature-parent") source.class.index = "wizard";
    if (kind === "subclass") source.subclass.index = "other";
    if (kind === "level") source.level = 2;
    if (kind === "prose") source.desc[1] = "Your AC is 15.";
    if (kind === "manifest") levels[0].level = 2;
    if (kind === "duplicate") levels[0].features.push("draconic-resilience");
    expect(() => subclassResilienceMechanics(root, levels, kind === "missing" ? undefined : source)).toThrow("unavailable or changed");
  });
  it("uses the existing best AC formula while unarmored, permits a shield and yields to worn armor", () => {
    const effects = subclassResilienceMechanics(draconicRoot, draconicLevels, draconicResilienceSource).effects;
    const schema = { ability_scores: ["dexterity"].map(slug => ({ slug, name: slug, abbr: "DEX" })),
      proficiency_levels: [], derived_stats: [{ slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" }],
      skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
    } satisfies SystemSchemaDefinition;
    expect(evaluate({ dexterity: 14 }, effects, schema, undefined, { equipped_armor: "none", shield_equipped: false }).computed.armor_class).toBe(15);
    expect(evaluate({ dexterity: 14 }, [...effects, { type: "mechanical", stat: "armor_class", op: "add", value: 2 }], schema,
      undefined, { equipped_armor: "none", shield_equipped: true }).computed.armor_class).toBe(17);
    expect(evaluate({ dexterity: 14 }, effects, schema, undefined, { equipped_armor: "light" }).computed.armor_class).toBe(12);
    expect(evaluate({ dexterity: 14 }, [...effects, { type: "mechanical", stat: "armor_class", op: "formula", expr: "18", tag: "ac_formula" }], schema,
      undefined, { equipped_armor: "none" }).computed.armor_class).toBe(18);
  });
});
