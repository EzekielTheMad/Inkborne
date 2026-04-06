import { describe, it, expect } from "vitest";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";

const MINIMAL_VALID_SCHEMA = {
  ability_scores: [{ slug: "strength", name: "Strength", abbr: "STR" }],
  proficiency_levels: [
    { slug: "none", name: "Not Proficient", multiplier: 0 },
    { slug: "proficient", name: "Proficient", multiplier: 1 },
  ],
  derived_stats: [
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
  ],
  skills: [{ slug: "athletics", name: "Athletics", ability: "strength" }],
  resources: [{ slug: "hit_points", name: "Hit Points", type: "current_max_temp" }],
  content_types: [{ slug: "species", name: "Species", required: true, max: 1 }],
  currencies: [{ slug: "gp", name: "Gold", rate: 100 }],
  creation_steps: [{ step: 1, type: "species", label: "Choose Species" }],
  sheet_sections: [{ slug: "header", label: "Character Header" }],
};

describe("System Schema Definition", () => {
  it("validates a minimal valid schema", () => {
    const result = systemSchemaDefinitionSchema.safeParse(MINIMAL_VALID_SCHEMA);
    expect(result.success).toBe(true);
  });

  it("rejects schema missing ability_scores", () => {
    const { ability_scores, ...rest } = MINIMAL_VALID_SCHEMA;
    const result = systemSchemaDefinitionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("validates derived stat with base instead of formula", () => {
    const schema = {
      ...MINIMAL_VALID_SCHEMA,
      derived_stats: [{ slug: "movement_speed", name: "Speed", base: 30 }],
    };
    const result = systemSchemaDefinitionSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it("validates sheet section with extension_zone", () => {
    const schema = {
      ...MINIMAL_VALID_SCHEMA,
      sheet_sections: [
        { slug: "features", label: "Features & Traits", tab: true, extension_zone: true },
      ],
    };
    const result = systemSchemaDefinitionSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it("validates content type with parent reference", () => {
    const schema = {
      ...MINIMAL_VALID_SCHEMA,
      content_types: [
        { slug: "class", name: "Class", required: true, max: null },
        { slug: "subclass", name: "Subclass", parent: "class" },
      ],
    };
    const result = systemSchemaDefinitionSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });
});
