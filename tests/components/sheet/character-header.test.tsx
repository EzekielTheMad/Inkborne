import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CharacterProvider } from "@/lib/character/character-context";
import { CharacterHeader } from "@/components/sheet/character-header";
import type { CharacterWithSystem } from "@/lib/types/character";

// The header imports the supabase client-side helper. We never invoke the
// owner-only flow in tests, but importing it triggers `createClient()` at
// module load. Mock the module so jsdom doesn't trip over env vars.
vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacterColor: vi.fn().mockResolvedValue(undefined),
}));

const mockCharacter = {
  id: "char-1",
  user_id: "user-1",
  system_id: "system-1",
  campaign_id: null,
  name: "Test Character",
  visibility: "private",
  archived: false,
  level: 1,
  base_stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  choices: { classes: [] },
  state: {},
  narrative: {},
  narrative_rich: {},
  primary_color: null,
  game_systems: {
    id: "system-1",
    name: "D&D 5e",
    slug: "dnd-5e",
    schema_definition: {
      abilities: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    } as unknown,
  },
} as unknown as CharacterWithSystem;

const mockSchema = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "intelligence", name: "Intelligence", abbr: "INT" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
    { slug: "charisma", name: "Charisma", abbr: "CHA" },
  ],
  proficiency_levels: [],
  derived_stats: [],
  skills: [],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [],
  sheet_sections: [],
};

function wrap(
  children: React.ReactNode,
  providerOverrides: Partial<React.ComponentProps<typeof CharacterProvider>> = {},
) {
  return render(
    <CharacterProvider
      character={mockCharacter}
      schema={mockSchema as any}
      contentRefs={[]}
      initialState={{} as any}
      initialInventory={[]}
      initialSpells={[]}
      classData={{} as any}
      allEffects={[]}
      baseStatsWithLevel={{
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      }}
      structuredSources={{} as any}
      isOwner={false}
      isDm={false}
      hasSheet={true}
      maxHp={10}
      primaryColor={null}
      onPrimaryColorChange={() => {}}
      {...providerOverrides}
    >
      {children}
    </CharacterProvider>,
  );
}

describe("<CharacterHeader> color carry-through", () => {
  it("applies the gradient backed by --character-color to the outer element", () => {
    const { container } = wrap(
      <CharacterHeader
        character={mockCharacter}
        inspiration={false}
        onToggleInspiration={() => {}}
      />,
    );
    const styled =
      container.querySelector('[style*="--character-color"]') ??
      container.querySelector('[style*="linear-gradient"]');
    expect(styled).toBeTruthy();
    expect(styled!.getAttribute("style")).toContain("var(--character-color)");
    expect(styled!.getAttribute("style")).toContain("linear-gradient(135deg");
  });

  it("renders an editable color trigger for owners", () => {
    const { container } = wrap(
      <CharacterHeader
        character={mockCharacter}
        inspiration={false}
        onToggleInspiration={() => {}}
      />,
      { isOwner: true },
    );
    expect(
      container.querySelector('[aria-label="Change character color"]'),
    ).toBeTruthy();
  });

  it("does NOT render a color trigger for non-owners", () => {
    const { container } = wrap(
      <CharacterHeader
        character={mockCharacter}
        inspiration={false}
        onToggleInspiration={() => {}}
      />,
      { isOwner: false },
    );
    expect(
      container.querySelector('[aria-label="Change character color"]'),
    ).toBeFalsy();
  });
});
