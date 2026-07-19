import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import {
  CharacterProvider,
  useRolls,
} from "@/lib/character/character-context";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { RollResult } from "@/lib/dice/types";
import type { RollLogEntry } from "@/lib/types/rolls";

// Mock the supabase paths the provider imports.
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
vi.mock("@/lib/supabase/rolls", () => ({
  insertRoll: vi.fn().mockResolvedValue(undefined),
}));

import { insertRoll } from "@/lib/supabase/rolls";

const mockedInsertRoll = vi.mocked(insertRoll);

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
  ability_scores: [],
  proficiency_levels: [],
  derived_stats: [],
  skills: [],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [],
  sheet_sections: [],
} as unknown;

function renderWithProvider(
  Probe: React.ComponentType,
  initialRolls?: RollLogEntry[],
) {
  return render(
    <CharacterProvider
      character={mockCharacter}
      schema={mockSchema as never}
      contentRefs={[]}
      initialState={{} as never}
      initialInventory={[]}
      initialSpells={[]}
      initialRolls={initialRolls}
      classData={{} as never}
      allEffects={[]}
      baseStatsWithLevel={{ level: 1 }}
      structuredSources={{} as never}
      isOwner={true}
      isDm={false}
      hasSheet={true}
      maxHp={10}
      primaryColor={null}
      onPrimaryColorChange={() => {}}
    >
      <Probe />
    </CharacterProvider>,
  );
}

const hydratedEntry: RollLogEntry = {
  id: "roll-db-1",
  character_id: "char-1",
  user_id: "user-1",
  kind: "save",
  label: "Wisdom Save",
  expression: "1d20+1",
  result: {
    request: { kind: "save", label: "Wisdom Save", expression: "1d20+1" },
    groups: [{ sides: 20, rolls: [9], kept: [9] }],
    modifier: 1,
    total: 10,
    natural: 9,
    rolled_at: "2026-07-15T20:00:00.000Z",
  },
  total: 10,
  rolled_at: "2026-07-15T20:00:00.000Z",
};

describe("useRolls()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInsertRoll.mockResolvedValue(undefined);
  });

  function Probe() {
    const { rolls, roll } = useRolls();
    return (
      <div>
        <button
          data-testid="roll"
          onClick={() => {
            const result = roll({
              kind: "check",
              label: "Athletics Check",
              expression: "1d20+5",
            });
            // The result must be available synchronously.
            document.title = `total:${result.total}`;
          }}
        />
        <span data-testid="count">{rolls.length}</span>
        <span data-testid="first">{rolls[0]?.label ?? "none"}</span>
      </div>
    );
  }

  it("hydrates the log from initialRolls", () => {
    renderWithProvider(Probe, [hydratedEntry]);
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("first").textContent).toBe("Wisdom Save");
  });

  it("roll() returns the result synchronously and prepends a session entry", async () => {
    renderWithProvider(Probe, [hydratedEntry]);
    await act(async () => {
      screen.getByTestId("roll").click();
    });
    expect(document.title).toMatch(/^total:\d+$/);
    expect(screen.getByTestId("count").textContent).toBe("2");
    // Newest first: the fresh roll sits at the head, hydrated row after it.
    expect(screen.getByTestId("first").textContent).toBe("Athletics Check");
  });

  it("persists via insertRoll with the executed result", async () => {
    renderWithProvider(Probe);
    await act(async () => {
      screen.getByTestId("roll").click();
    });
    expect(mockedInsertRoll).toHaveBeenCalledTimes(1);
    const [characterId, result] = mockedInsertRoll.mock.calls[0] as [
      string,
      RollResult,
    ];
    expect(characterId).toBe("char-1");
    expect(result.request).toMatchObject({
      kind: "check",
      label: "Athletics Check",
      expression: "1d20+5",
    });
    expect(result.total).toBeGreaterThanOrEqual(6); // 1+5
    expect(result.total).toBeLessThanOrEqual(25); // 20+5
  });

  it("a persist failure logs to console and does not throw or drop the entry", async () => {
    mockedInsertRoll.mockRejectedValueOnce(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithProvider(Probe);
    await act(async () => {
      screen.getByTestId("roll").click();
    });
    // Session log keeps the roll regardless of persistence.
    expect(screen.getByTestId("count").textContent).toBe("1");
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to persist roll:",
        expect.any(Error),
      );
    });
    errorSpy.mockRestore();
  });

  it("session entries carry unique ids and the character/user identity", async () => {
    let captured: RollLogEntry[] = [];
    function CaptureProbe() {
      const { rolls, roll } = useRolls();
      useEffect(() => {
        captured = rolls;
      }, [rolls]);
      return (
        <button
          data-testid="roll"
          onClick={() =>
            roll({ kind: "damage", label: "Dagger", expression: "1d4+2" })
          }
        />
      );
    }
    renderWithProvider(CaptureProbe);
    await act(async () => {
      screen.getByTestId("roll").click();
    });
    await act(async () => {
      screen.getByTestId("roll").click();
    });
    expect(captured).toHaveLength(2);
    expect(captured[0].id).not.toBe(captured[1].id);
    expect(captured[0]).toMatchObject({
      character_id: "char-1",
      user_id: "user-1",
      kind: "damage",
      label: "Dagger",
      expression: "1d4+2",
    });
    expect(captured[0].total).toBe(captured[0].result.total);
  });
});
