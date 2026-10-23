import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { StatPreview } from "@/components/builder/stat-preview";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";

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
  const schema: SystemSchemaDefinition = { ...mockSchema,
    ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug, name: slug, abbr: slug.slice(0, 3) })),
    derived_stats: [
      { slug: "proficiency_bonus", name: "Proficiency Bonus", formula: "floor((level - 1) / 4) + 2" },
      { slug: "hit_points_max", name: "Hit Point Maximum", formula: "hit_die_total + (mod(constitution) * level)" },
      { slug: "spell_save_dc", name: "Spell Save DC", formula: "8 + proficiency_bonus + mod(spellcasting_ability)" },
      { slug: "spell_attack_bonus", name: "Spell Attack Bonus", formula: "proficiency_bonus + mod(spellcasting_ability)" },
    ] };
  const base = { strength: 8, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 16, charisma: 15 };
  const sources = { asi: { status: "available" as const, effects: [], allocations: [] } };
  const source = (slug: string, classLevel: number, ability: string): EffectiveCastingSource => ({
    classSlug: slug, classLevel, kind: "class", parentPin: { contentId: `${slug}-pin`, version: 1 }, active: true,
    config: { type: slug === "warlock" ? "pact" : "full", ability }, cantripsKnown: 2, spellsKnown: 3,
    prepared: false, preparationRule: "parent", spellList: { class: slug, level: [0, 9] }, directSlots: [2], maxLearnableLevel: 1,
  });
  const definition = (slug: string) => ({ id: `${slug}-pin`, version: 1, slug,
    name: slug === "warlock" ? "Warlock" : "Cleric", data: { hit_die: 8 } });
  const valueFor = (container: HTMLElement, label: string) => within(container).getByText(label).parentElement?.lastElementChild?.textContent;

  it("shows saved Warlock HP and CHA-based casting instead of generic schema placeholders", () => {
    render(<StatPreview baseStats={base} effects={[]} schema={schema} level={2} sources={sources}
      classContext={{ available: true, choices: { classes: [{ slug: "warlock", level: 2, occurrence_id: "warlock-occurrence" }] },
        classContent: { warlock: definition("warlock") }, originalOccurrenceId: "warlock-occurrence", hpRule: "free_choice",
        castingSources: [source("warlock", 2, "charisma")] }} />);
    expect(valueFor(document.body, "Hit Point Maximum")).toBe("15");
    const casting = screen.getByRole("group", { name: "Warlock spellcasting" });
    expect(valueFor(casting, "Spell Save DC")).toBe("12");
    expect(valueFor(casting, "Spell Attack Bonus")).toBe("+4");
    expect(screen.getAllByText("Spell Save DC")).toHaveLength(1);
  });

  it("keeps each multiclass casting ability distinct and uses the proved original HP occurrence", () => {
    render(<StatPreview baseStats={base} effects={[]} schema={schema} level={3} sources={sources}
      classContext={{ available: true, choices: { classes: [
        { slug: "cleric", level: 1, occurrence_id: "cleric-occurrence" }, { slug: "warlock", level: 2, occurrence_id: "warlock-occurrence" },
      ] }, classContent: { warlock: definition("warlock"), cleric: definition("cleric") },
        originalOccurrenceId: "warlock-occurrence", hpRule: "free_choice",
        castingSources: [source("warlock", 2, "charisma"), source("cleric", 1, "wisdom")] }} />);
    expect(valueFor(document.body, "Hit Point Maximum")).toBe("21");
    expect(valueFor(screen.getByRole("group", { name: "Warlock spellcasting" }), "Spell Save DC")).toBe("12");
    expect(valueFor(screen.getByRole("group", { name: "Cleric spellcasting" }), "Spell Save DC")).toBe("13");
  });

  it("does not present class-dependent schema defaults as saved mechanics without exact context", () => {
    render(<StatPreview baseStats={base} effects={[]} schema={schema} level={2} sources={sources} />);
    expect(valueFor(document.body, "Hit Point Maximum")).toBe("Unavailable");
    expect(screen.queryByText("Spell Save DC")).not.toBeInTheDocument();
    expect(screen.queryByText("Spell Attack Bonus")).not.toBeInTheDocument();
  });
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
