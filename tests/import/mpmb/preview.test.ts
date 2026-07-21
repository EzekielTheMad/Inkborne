// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildMpmbCalculationPreview } from "@/lib/import/mpmb/preview";
import { featDataSchema } from "@/lib/schemas/content-types/feat";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import type { SystemSchemaDefinition } from "@/lib/types/system";

const SCHEMA: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "intelligence", name: "Intelligence", abbr: "INT" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
    { slug: "charisma", name: "Charisma", abbr: "CHA" },
  ],
  proficiency_levels: [
    { slug: "none", name: "None", multiplier: 0 },
    { slug: "proficient", name: "Proficient", multiplier: 1 },
  ],
  derived_stats: [
    { slug: "proficiency_bonus", name: "Proficiency Bonus", formula: "floor((level - 1) / 4) + 2" },
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
    { slug: "initiative", name: "Initiative", formula: "mod(dexterity)" },
  ],
  skills: [],
  resources: [],
  content_types: [{ slug: "feat", name: "Feat" }],
  currencies: [],
  creation_steps: [{ step: 1, type: "details", label: "Details" }],
  sheet_sections: [{ slug: "header", label: "Header" }],
};

const featData = featDataSchema.parse({
  description: "A safe synthetic feat.",
  prerequisites: [],
  scores: [0, 1, 0, 0, 0, 0],
  speed: { walk: 5 },
  vision: [{ type: "darkvision", range: 60 }],
  dmgres: ["fire"],
  savetxt: { adv_vs: ["charmed"], immune: ["magical sleep"] },
  skills: ["perception"],
  weaponProfs: [],
  armorProfs: [],
  toolProfs: [],
  languageProfs: [],
  spellcastingBonus: [],
  extraLimitedFeatures: [],
  calcChanges: [],
  addMod: [],
  source_refs: [],
});

const spellData = spellDataSchema.parse({
  level: 1,
  school: "evocation",
  casting_time: "1 action",
  range: "60 feet",
  components: ["V", "S"],
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  description: "A safe synthetic spell.",
  attack_type: "ranged",
  damage: {
    type: "fire",
    dice_at_slot_level: { "1": "1d8 + MOD", "3": "2d8 + MOD" },
  },
  dc: { type: "dexterity", success: "half" },
  classes: ["wizard"],
  subclasses: [],
  dependencies: [],
});

describe("buildMpmbCalculationPreview", () => {
  it("evaluates a feat independently through numeric and structured sheet paths", () => {
    const preview = buildMpmbCalculationPreview(SCHEMA, [{
      id: "feat-1",
      contentType: "feat",
      name: "Steadfast Adept",
      slug: "steadfast-adept",
      data: featData,
      effects: [
        { type: "narrative", text: "A safe synthetic feat.", tag: "Feat" },
        { type: "mechanical", stat: "dexterity", op: "add", value: 1 },
        { type: "mechanical", stat: "armor_class", op: "add", value: 1 },
      ],
    }]);

    expect(preview.passed).toBe(true);
    const item = preview.items[0];
    expect(item).toMatchObject({
      contentType: "feat",
      status: "passed",
      name: "Steadfast Adept",
    });
    if (item.status !== "passed" || item.contentType !== "feat") return;
    expect(item.levels).toHaveLength(4);
    expect(item.levels[0].abilities).toContainEqual({
      slug: "dexterity",
      label: "Dexterity",
      before: 10,
      after: 11,
      delta: 1,
    });
    expect(item.levels[0].derivedStats).toContainEqual({
      slug: "armor_class",
      label: "Armor Class",
      before: 10,
      after: 11,
      delta: 1,
    });
    expect(item.levels[0].speed).toContainEqual(
      expect.objectContaining({ slug: "walk", before: 30, after: 35 }),
    );
    expect(item.levels[0].visionAdded).toEqual([{ type: "darkvision", range: 60 }]);
    expect(item.levels[0].damageResistancesAdded).toEqual(["fire"]);
    expect(item.levels[0].saveAdvantagesAdded).toEqual(["charmed"]);
    expect(item.levels[0].saveImmunitiesAdded).toEqual(["magical sleep"]);
    expect(item.warnings).toContainEqual(expect.stringContaining("skill proficiencies"));
  });

  it("test-casts a spell at every legal slot and validates generated dice", () => {
    const preview = buildMpmbCalculationPreview(SCHEMA, [{
      id: "spell-1",
      contentType: "spell",
      name: "Ember Lance",
      slug: "ember-lance",
      data: spellData,
      effects: [],
    }]);

    expect(preview.passed).toBe(true);
    const item = preview.items[0];
    if (item.status !== "passed" || item.contentType !== "spell") {
      throw new Error("Expected a passed spell preview");
    }
    expect(item.casts).toHaveLength(9);
    expect(item.casts[0]).toMatchObject({
      label: "Base cast (level 1)",
      castLevel: 1,
      dc: { ability: "dexterity", value: 13, success: "half" },
    });
    expect(item.casts[0].rolls.map((roll) => roll.expression)).toEqual([
      "1d20+5",
      "1d8 + 3",
    ]);
    expect(item.casts[2].rolls.map((roll) => roll.expression)).toContain("2d8 + 3");
  });

  it("turns malformed cast expressions and evaluator errors into item failures", () => {
    const invalidSpell = spellDataSchema.parse({
      ...spellData,
      damage: { type: "fire", dice_at_slot_level: { "1": "2x6" } },
    });
    const preview = buildMpmbCalculationPreview(SCHEMA, [
      {
        id: "spell-bad",
        contentType: "spell",
        name: "Broken Bolt",
        slug: "broken-bolt",
        data: invalidSpell,
        effects: [],
      },
      {
        id: "feat-bad",
        contentType: "feat",
        name: "Broken Formula",
        slug: "broken-formula",
        data: featData,
        effects: [{
          type: "mechanical",
          stat: "armor_class",
          op: "formula",
          expr: "not(",
        }],
      },
    ]);

    expect(preview.passed).toBe(false);
    expect(preview.items).toEqual([
      expect.objectContaining({ id: "spell-bad", status: "failed" }),
      expect.objectContaining({ id: "feat-bad", status: "failed" }),
    ]);
  });

  it("returns a minimal browser-safe result without candidate data/effect fields", () => {
    const preview = buildMpmbCalculationPreview(SCHEMA, [{
      id: "feat-1",
      contentType: "feat",
      name: "Steadfast Adept",
      slug: "steadfast-adept",
      data: featData,
      effects: [],
    }]);
    const serialized = JSON.stringify(preview);

    expect(serialized).not.toMatch(/"data":/);
    expect(serialized).not.toMatch(/"effects":/);
  });

  it("cannot pass an empty selection", () => {
    expect(buildMpmbCalculationPreview(SCHEMA, [])).toMatchObject({
      passed: false,
      items: [],
    });
  });
});
