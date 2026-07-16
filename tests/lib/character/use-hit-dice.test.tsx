import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  CharacterProvider,
  useRest,
} from "@/lib/character/character-context";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { CharacterState } from "@/lib/types/character";

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

import { updateCharacterState } from "@/lib/sheet/update-state";
import { insertRoll } from "@/lib/supabase/rolls";
import type { RollResult } from "@/lib/dice/types";

const mockedUpdateState = vi.mocked(updateCharacterState);
const mockedInsertRoll = vi.mocked(insertRoll);

// Fighter 3 / Wizard 2, CON 14 (+2).
const mockCharacter = {
  id: "char-1",
  user_id: "user-1",
  system_id: "system-1",
  campaign_id: null,
  name: "Test Multiclasser",
  visibility: "private",
  archived: false,
  level: 5,
  base_stats: {
    strength: 10,
    dexterity: 10,
    constitution: 14,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  choices: {
    classes: [
      { slug: "fighter", level: 3 },
      { slug: "wizard", level: 2 },
    ],
  },
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

const classData = {
  fighter: { slug: "fighter", data: { hit_die: 10 } },
  wizard: { slug: "wizard", data: { hit_die: 6 } },
} as never;

const MAX_HP = 40;

function renderWithProvider(
  Probe: React.ComponentType,
  initialState: CharacterState = {},
) {
  return render(
    <CharacterProvider
      character={mockCharacter}
      schema={mockSchema as never}
      contentRefs={[]}
      initialState={initialState as never}
      initialInventory={[]}
      initialSpells={[]}
      classData={classData}
      allEffects={[]}
      baseStatsWithLevel={{ ...mockCharacter.base_stats, level: 5 }}
      structuredSources={{} as never}
      isOwner={true}
      isDm={false}
      hasSheet={true}
      maxHp={MAX_HP}
      primaryColor={null}
      onPrimaryColorChange={() => {}}
    >
      <Probe />
    </CharacterProvider>,
  );
}

let lastResult: RollResult | null | undefined;

function Probe() {
  const { hitDicePools, spendHitDie } = useRest();
  return (
    <div>
      <span data-testid="pools">
        {hitDicePools
          .map((p) => `${p.classSlug}:d${p.die}:${p.max - p.spent}/${p.max}`)
          .join(",")}
      </span>
      <button
        data-testid="spend-fighter"
        onClick={async () => {
          lastResult = await spendHitDie("fighter");
        }}
      />
      <button
        data-testid="spend-wizard"
        onClick={async () => {
          lastResult = await spendHitDie("wizard");
        }}
      />
    </div>
  );
}

describe("useRest() — hit dice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastResult = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives multiclass pools from class levels and content die sizes", () => {
    renderWithProvider(Probe, { hit_dice_spent: { fighter: 1 } });
    expect(screen.getByTestId("pools").textContent).toBe(
      "fighter:d10:2/3,wizard:d6:2/2",
    );
  });

  it("spendHitDie rolls 1d10+2 and applies spend + heal as ONE atomic patch", async () => {
    // Seed the die: rng 0.5 on a d10 → face 6; +2 CON → heal 8.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderWithProvider(Probe, { current_hp: 10 });

    await act(async () => {
      screen.getByTestId("spend-fighter").click();
    });

    expect(lastResult?.request.expression).toBe("1d10+2");
    expect(lastResult?.request.kind).toBe("hit_die");
    expect(lastResult?.total).toBe(8);

    // Exactly one state write carrying BOTH the spend and the heal.
    expect(mockedUpdateState).toHaveBeenCalledTimes(1);
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", {
      hit_dice_spent: { fighter: 1 },
      current_hp: 18,
    });
  });

  it("uses the class's own die size for the second class (wizard d6)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderWithProvider(Probe, { current_hp: 10 });

    await act(async () => {
      screen.getByTestId("spend-wizard").click();
    });

    expect(lastResult?.request.expression).toBe("1d6+2");
    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", {
      hit_dice_spent: { wizard: 1 },
      current_hp: 16, // d6 face 4 + 2
    });
  });

  it("the roll lands in the roll log pipeline (insertRoll fired)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderWithProvider(Probe, { current_hp: 10 });

    await act(async () => {
      screen.getByTestId("spend-fighter").click();
    });

    expect(mockedInsertRoll).toHaveBeenCalledTimes(1);
    const [characterId, result] = mockedInsertRoll.mock.calls[0] as [
      string,
      RollResult,
    ];
    expect(characterId).toBe("char-1");
    expect(result.request.kind).toBe("hit_die");
  });

  it("clamps healing at max HP", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // d10 face 10, +2 → 12
    renderWithProvider(Probe, { current_hp: 35 });

    await act(async () => {
      screen.getByTestId("spend-fighter").click();
    });

    expect(mockedUpdateState).toHaveBeenCalledWith("char-1", {
      hit_dice_spent: { fighter: 1 },
      current_hp: MAX_HP,
    });
  });

  it("resolves null without rolling or patching when the pool is empty", async () => {
    renderWithProvider(Probe, {
      current_hp: 10,
      hit_dice_spent: { fighter: 3 },
    });

    await act(async () => {
      screen.getByTestId("spend-fighter").click();
    });

    expect(lastResult).toBeNull();
    expect(mockedUpdateState).not.toHaveBeenCalled();
    expect(mockedInsertRoll).not.toHaveBeenCalled();
  });

  it("resolves null without rolling or patching when HP is already full", async () => {
    renderWithProvider(Probe, { current_hp: MAX_HP });

    await act(async () => {
      screen.getByTestId("spend-fighter").click();
    });

    expect(lastResult).toBeNull();
    expect(mockedUpdateState).not.toHaveBeenCalled();
  });

  it("resolves null for an unknown class slug", async () => {
    let result: RollResult | null | undefined;
    function UnknownProbe() {
      const { spendHitDie } = useRest();
      return (
        <button
          data-testid="spend"
          onClick={async () => {
            result = await spendHitDie("rogue");
          }}
        />
      );
    }
    renderWithProvider(UnknownProbe, { current_hp: 10 });

    await act(async () => {
      screen.getByTestId("spend").click();
    });

    expect(result).toBeNull();
    expect(mockedUpdateState).not.toHaveBeenCalled();
  });

  it("repeated spends accumulate: pools shrink and HP rises across clicks", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderWithProvider(Probe, { current_hp: 5 });

    await act(async () => {
      screen.getByTestId("spend-fighter").click();
    });
    await act(async () => {
      screen.getByTestId("spend-fighter").click();
    });

    expect(mockedUpdateState).toHaveBeenCalledTimes(2);
    expect(mockedUpdateState).toHaveBeenLastCalledWith("char-1", {
      hit_dice_spent: { fighter: 2 },
      current_hp: 21, // 5 + 8 + 8
    });
    expect(screen.getByTestId("pools").textContent).toBe(
      "fighter:d10:1/3,wizard:d6:2/2",
    );
  });
});
