import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacter } from "@/lib/character/character-context";
import { ResourcesWidget } from "@/components/sheet/resources-widget";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { providerAbilities, providerBase, providerCharacterId, providerRaceRef, providerSources, providerSystemId } from "../../fixtures/provider-mechanics";
import { pinnedSlotClass } from "../../fixtures/pinned-slot-class";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { CharacterWithSystem } from "@/lib/types/character";

vi.mock("@/lib/sheet/update-state", () => ({ updateCharacterState: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));

const bard = pinnedSlotClass("bard", 3, "full", [4, 2, 0, 0, 0, 0, 0, 0, 0], providerCharacterId, providerSystemId);
const inspiration: ContentRefWithContent = {
  id: "b6666666-6666-4666-8666-666666666666", character_id: providerCharacterId,
  content_id: "b7777777-7777-4777-8777-777777777777", content_version: 1,
  feature_grant_id: null, context: {}, choice_source: null, created_at: "2026-10-29T00:00:00Z",
  content_definitions: {
    id: "b7777777-7777-4777-8777-777777777777", system_id: providerSystemId, version: 1,
    slug: "bardic-inspiration-d6", name: "Bardic Inspiration (d6)", content_type: "feature",
    source: "srd", scope: "platform", owner_id: null, effects: [],
    data: featureDataSchema.parse({ class: "bard", level: 1, usages: 1, recovery: "long rest",
      description: "You can use this feature a number of times equal to your Charisma modifier (a minimum of once)." }),
  },
};
const refs = [bard, providerRaceRef("human"), inspiration];
function Consumer() {
  const { mechanics, evalResult } = useCharacter();
  return <><output aria-label="Mechanics evidence">{JSON.stringify({ mechanics, asi: evalResult.asi })}</output><ResourcesWidget /></>;
}
function Fixture({ charisma = 16, formula = "floor((charisma - 10) / 2)", ambiguous = false }: { charisma?: number; formula?: string; ambiguous?: boolean }) {
  const schema = { ability_scores: providerAbilities, proficiency_levels: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
    derived_stats: [{ slug: "proficiency_bonus", base: 2 }, { slug: "charisma_mod", formula }, ...(ambiguous ? [{ slug: "charisma_mod", formula }] : [])] };
  const character = { id: providerCharacterId, system_id: providerSystemId, user_id: "local-owner", name: "Bard capacity fixture", level: 3,
    campaign_id: null, choices: { classes: [{ slug: "bard", level: 3 }], race: "human", ability_method: "manual" }, base_stats: { ...providerBase, charisma }, state: {}, narrative: {},
    game_systems: { id: providerSystemId, slug: "dnd-5e-2014", name: "D&D 5e 2014", schema_definition: schema } } as unknown as CharacterWithSystem;
  return <CharacterProvider character={character} schema={schema as never} contentRefs={refs} contentSnapshotsComplete
    initialState={{ current_hp: 24, temp_hp: 0 }} initialInventory={[]} initialSpells={[]}
    classData={{ bard: { slug: "bard", data: bard.content_definitions.data } } as never}
    allEffects={[]} baseStatsWithLevel={{ ...character.base_stats, level: 3 }} structuredSources={providerSources(character, refs)}
    isOwner isDm={false} hasSheet maxHp={24} primaryColor={null} onPrimaryColorChange={() => {}}>
    <Consumer />
  </CharacterProvider>;
}
afterEach(cleanup);
describe("Bardic capacity through the real provider/widget; no database acceptance", () => {
  it("shows three uses at CHA16 and updates when confirmed ability inputs change", () => {
    const view = render(<Fixture />);
    expect(screen.getByLabelText("Mechanics evidence")).toHaveTextContent('"mechanics":{"status":"available"');
    expect(screen.getByText("Bardic Inspiration (d6)")).toBeInTheDocument();
    expect(screen.getByText("3/3")).toBeInTheDocument();
    view.rerender(<Fixture charisma={18} />);
    expect(screen.getByText("4/4")).toBeInTheDocument();
    expect(inspiration.content_definitions.data.usages).toBe(1);
  });
  it("uses the confirmed declared modifier instead of calculating another ability formula", () => {
    render(<Fixture formula="4" />);
    expect(screen.getByText("4/4")).toBeInTheDocument();
  });
  it("does not show a fabricated one-use counter for ambiguous modifier authority", () => {
    render(<Fixture ambiguous />);
    expect(screen.queryByText("Bardic Inspiration (d6)")).not.toBeInTheDocument();
  });
});
