import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  CharacterProvider,
  useCharacter,
  useCharacterState,
  useInventory,
  useSpells,
} from "@/lib/character/character-context";
import type {
  CharacterWithSystem,
  CharacterState,
} from "@/lib/types/character";

// Mock the supabase paths the provider invokes.
vi.mock("@/lib/sheet/update-state", () => ({
  updateCharacterState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/inventory", () => ({
  addInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn().mockResolvedValue(undefined),
  removeInventoryItem: vi.fn().mockResolvedValue(undefined),
  unequipAllArmor: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/spells", () => ({
  addCharacterSpell: vi.fn(),
  updateCharacterSpell: vi.fn().mockResolvedValue(undefined),
  removeCharacterSpell: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/character-client", () => ({
  updateCharacter: vi.fn().mockResolvedValue(undefined),
  updateCharacterColor: vi.fn().mockResolvedValue(undefined),
}));

import { updateCharacterState } from "@/lib/sheet/update-state";
import { addInventoryItem } from "@/lib/supabase/inventory";
import { addCharacterSpell } from "@/lib/supabase/spells";

const mockedUpdateState = vi.mocked(updateCharacterState);
const mockedAddInventoryItem = vi.mocked(addInventoryItem);
const mockedAddSpell = vi.mocked(addCharacterSpell);

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
    schema_definition: {} as unknown,
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
} as unknown;

interface ProbeProps {
  initialState?: CharacterState;
  primaryColor?: string | null;
  onPrimaryColorChange?: (c: string | null) => void;
}

function renderWithProvider(
  Probe: React.ComponentType,
  overrides: ProbeProps = {},
) {
  return render(
    <CharacterProvider
      character={mockCharacter}
      schema={mockSchema as never}
      contentRefs={[]}
      initialState={overrides.initialState ?? ({} as never)}
      initialInventory={[]}
      initialSpells={[]}
      classData={{} as never}
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
      structuredSources={{} as never}
      isOwner={true}
      isDm={false}
      hasSheet={true}
      maxHp={10}
      primaryColor={overrides.primaryColor ?? null}
      onPrimaryColorChange={overrides.onPrimaryColorChange ?? (() => {})}
    >
      <Probe />
    </CharacterProvider>,
  );
}

describe("<CharacterProvider> public hook surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCharacter() exposes character, schema, contentRefs, isOwner, isDm, hasSheet", () => {
    function Probe() {
      const c = useCharacter();
      return (
        <div>
          <span data-testid="name">{c.character.name}</span>
          <span data-testid="isOwner">{String(c.isOwner)}</span>
          <span data-testid="isDm">{String(c.isDm)}</span>
          <span data-testid="hasSheet">{String(c.hasSheet)}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("name").textContent).toBe("Test Character");
    expect(screen.getByTestId("isOwner").textContent).toBe("true");
    expect(screen.getByTestId("isDm").textContent).toBe("false");
    expect(screen.getByTestId("hasSheet").textContent).toBe("true");
  });

  it("useCharacter() exposes primaryColor and setPrimaryColor (PR-F)", () => {
    const onChange = vi.fn();
    function Probe() {
      const c = useCharacter();
      return (
        <button
          data-testid="set"
          onClick={() => c.setPrimaryColor("#7c3aed")}
        >
          {c.primaryColor ?? "none"}
        </button>
      );
    }
    renderWithProvider(Probe, {
      primaryColor: "#abcdef",
      onPrimaryColorChange: onChange,
    });
    expect(screen.getByTestId("set").textContent).toBe("#abcdef");
    act(() => {
      screen.getByTestId("set").click();
    });
    expect(onChange).toHaveBeenCalledWith("#7c3aed");
  });

  it("useCharacterState().patchState calls the atomic-merge RPC and updates local state", async () => {
    function Probe() {
      const { state, patchState } = useCharacterState();
      return (
        <button
          data-testid="apply"
          onClick={() => {
            void patchState({ current_hp: 7 });
          }}
        >
          {String((state as CharacterState).current_hp ?? "null")}
        </button>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("apply").textContent).toBe("null");
    await act(async () => {
      screen.getByTestId("apply").click();
    });
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", { current_hp: 7 });
    expect(screen.getByTestId("apply").textContent).toBe("7");
  });

  it("useCharacterState().patchState swallows server errors after applying local state (matches current behavior)", async () => {
    mockedUpdateState.mockRejectedValueOnce(new Error("RLS denied"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Probe() {
      const { state, patchState } = useCharacterState();
      return (
        <button
          data-testid="apply"
          onClick={() => {
            void patchState({ current_hp: 7 });
          }}
        >
          {String((state as CharacterState).current_hp ?? "null")}
        </button>
      );
    }
    renderWithProvider(Probe);
    await act(async () => {
      screen.getByTestId("apply").click();
    });
    // The provider currently logs but does not revert local state (atomic-merge
    // RPC path; revert is a separate scope). This test pins that disposition.
    expect(errorSpy).toHaveBeenCalled();
    expect(screen.getByTestId("apply").textContent).toBe("7");
    errorSpy.mockRestore();
  });

  it("useInventory().addItem appends the returned row to local inventory", async () => {
    mockedAddInventoryItem.mockResolvedValueOnce({
      id: "inv-1",
      character_id: "char-1",
      content_id: "potion-of-healing",
      name: "Potion of Healing",
      quantity: 1,
      equipped: false,
      attuned: false,
      notes: null,
      custom_data: null,
    } as never);
    function Probe() {
      const { inventory, addItem } = useInventory();
      return (
        <div>
          <button
            data-testid="add"
            onClick={() => {
              void addItem({
                content_id: "potion-of-healing",
                name: "Potion of Healing",
                content_type: "item",
              });
            }}
          />
          <span data-testid="count">{inventory.length}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("count").textContent).toBe("0");
    await act(async () => {
      screen.getByTestId("add").click();
    });
    expect(mockedAddInventoryItem).toHaveBeenCalledWith("char-1", {
      content_id: "potion-of-healing",
      name: "Potion of Healing",
      content_type: "item",
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("useSpells().addSpell appends the returned row to local spells", async () => {
    mockedAddSpell.mockResolvedValueOnce({
      id: "spell-1",
      character_id: "char-1",
      content_id: "magic-missile",
      name: "Magic Missile",
      level: 1,
      always_prepared: false,
      always_known: false,
      prepared: false,
    } as never);
    function Probe() {
      const { spells, addSpell } = useSpells();
      return (
        <div>
          <button
            data-testid="add"
            onClick={() => {
              void addSpell({
                content_id: "magic-missile",
                name: "Magic Missile",
                level: 1,
              } as never);
            }}
          />
          <span data-testid="count">{spells.length}</span>
        </div>
      );
    }
    renderWithProvider(Probe);
    expect(screen.getByTestId("count").textContent).toBe("0");
    await act(async () => {
      screen.getByTestId("add").click();
    });
    expect(mockedAddSpell).toHaveBeenCalled();
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("useCharacter() throws when called outside <CharacterProvider>", () => {
    function Probe() {
      useCharacter();
      return null;
    }
    // Suppress React's error logging for the expected throw.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /Character hook used outside CharacterProvider/,
    );
    errorSpy.mockRestore();
  });
});
