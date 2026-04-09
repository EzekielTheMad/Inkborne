import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatPreview } from "@/components/builder/stat-preview";
import type { SystemSchemaDefinition } from "@/lib/types/system";

// Minimal schema for testing
const mockSchema: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
  ],
  proficiency_levels: [{ slug: "proficient", name: "Proficient", multiplier: 1 }],
  derived_stats: [
    { slug: "proficiency_bonus", name: "Proficiency Bonus", formula: "floor(level / 4) + 2" },
    { slug: "armor_class", name: "Armor Class", base: 10 },
  ],
  skills: [{ slug: "athletics", name: "Athletics", ability: "strength" }],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [],
  sheet_sections: [],
};

describe("StatPreview", () => {
  it("displays ability score modifiers", () => {
    render(
      <StatPreview
        baseStats={{ strength: 16, dexterity: 14 }}
        effects={[]}
        schema={mockSchema}
        level={1}
      />,
    );

    // Strength 16 = modifier +3
    expect(screen.getByText("+3")).toBeTruthy();
    // Dexterity 14 = modifier +2
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("renders when no stats are set", () => {
    render(
      <StatPreview
        baseStats={{}}
        effects={[]}
        schema={mockSchema}
        level={1}
      />,
    );

    // Should show the component without crashing
    expect(screen.getByText("Stats")).toBeTruthy();
  });
});
