import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import type {
  CasterInfo,
  CharacterSpell,
  ConcentrationState,
  MaxSlotsByLevel,
  SpellSlotsUsed,
} from "@/lib/types/spells";
import type { CastChoice, CastOutcome } from "@/lib/spells/casting";
import type { RollRequest, RollResult } from "@/lib/dice/types";

// ---------------------------------------------------------------------------
// Context mocks
// ---------------------------------------------------------------------------

const castSpell = vi.fn<(spell: CharacterSpell, choice: CastChoice) => Promise<CastOutcome>>();
const roll = vi.fn<(request: RollRequest) => RollResult>();

let mockMaxSlots: MaxSlotsByLevel = {};
let mockSlotState: SpellSlotsUsed = {};
let mockPactSlotLevel: number | null = null;
let mockConcentration: ConcentrationState | null = null;
let mockCasterInfo: CasterInfo;

vi.mock("@/lib/builder/use-is-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/character/character-context", () => ({
  useCharacter: () => ({ character: { id: "char-1", level: 3 } }),
  useSpells: () => ({
    maxSlots: mockMaxSlots,
    slotState: mockSlotState,
    pactSlotLevel: mockPactSlotLevel,
    casterInfo: mockCasterInfo,
    concentration: mockConcentration,
    castSpell,
  }),
  useRolls: () => ({ roll }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mkCasterInfo(): CasterInfo {
  return {
    isCaster: true,
    classes: [
      {
        slug: "wizard",
        level: 3,
        type: "full",
        ability: "intelligence",
        prepared: true,
        cantripsKnown: 3,
        spellsKnown: "all",
        maxPrepared: 6,
        ritualCasting: true,
      },
    ],
    spellDc: 13,
    spellAttackBonus: 5,
  };
}

function mkSpell(
  dataOverrides: Record<string, unknown> = {},
  overrides: Partial<CharacterSpell> = {},
): CharacterSpell {
  return {
    id: "spell-1",
    character_id: "char-1",
    content_id: "content-1",
    name: "Burning Hands",
    class_slug: "wizard",
    is_known: true,
    is_prepared: true,
    always_prepared: false,
    in_spellbook: true,
    source: "selection",
    custom_data: null,
    created_at: new Date().toISOString(),
    content_definitions: {
      id: "content-1",
      name: "Burning Hands",
      slug: "burning-hands",
      content_type: "spell",
      data: {
        level: 1,
        school: "evocation",
        components: ["V", "S"],
        range: "Self (15-foot cone)",
        casting_time: "1 action",
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        damage: {
          type: "fire",
          dice_at_slot_level: { "1": "3d6", "2": "4d6", "3": "5d6" },
        },
        dc: { type: "dexterity", success: "half" },
        ...dataOverrides,
      },
      effects: [],
    },
    ...overrides,
  } as CharacterSpell;
}

function mkOutcome(overrides: Partial<CastOutcome> = {}): CastOutcome {
  return {
    statePatch: { spell_slots_used: { "1": 1 } },
    rollRequests: [],
    activeEffect: null,
    castLevel: 1,
    dcInfo: null,
    ...overrides,
  };
}

function mkRollResult(overrides: Partial<RollResult> = {}): RollResult {
  return {
    request: { kind: "attack", label: "x", expression: "1d20+5" },
    groups: [{ sides: 20, rolls: [12], kept: [12] }],
    modifier: 5,
    total: 17,
    natural: 12,
    rolled_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderDialog(
  spell = mkSpell(),
  castability: "full" | "ritual-only" = "full",
) {
  const onClose = vi.fn();
  render(
    <CastDialog spell={spell} castability={castability} open onClose={onClose} />,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMaxSlots = { "1": 4, "2": 2 };
  mockSlotState = {};
  mockPactSlotLevel = null;
  mockConcentration = null;
  mockCasterInfo = mkCasterInfo();
  castSpell.mockResolvedValue(mkOutcome());
  roll.mockReturnValue(mkRollResult());
});

// ---------------------------------------------------------------------------
// Configure pane
// ---------------------------------------------------------------------------

describe("CastDialog — configure pane", () => {
  it("renders slot options and defaults to the lowest available", () => {
    renderDialog();
    const first = screen.getByRole("radio", { name: /1st/ });
    const second = screen.getByRole("radio", { name: /2nd/ });
    expect(first).toHaveAttribute("aria-checked", "true");
    expect(second).toHaveAttribute("aria-checked", "false");
  });

  it("disables exhausted levels and defaults past them", () => {
    mockSlotState = { "1": 4 };
    renderDialog();
    expect(screen.getByRole("radio", { name: /1st/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /2nd/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("updates the upcast damage preview when the selection changes", () => {
    renderDialog();
    expect(screen.getByText(/3d6\s*fire damage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /2nd/ }));
    expect(screen.getByText(/4d6\s*fire damage/)).toBeInTheDocument();
  });

  it("shows the save DC in the preview", () => {
    renderDialog();
    expect(screen.getByText(/Dexterity save DC 13/)).toBeInTheDocument();
    expect(screen.getByText(/half on success/)).toBeInTheDocument();
  });

  it("offers pact slots as a first-class option", () => {
    mockMaxSlots = { "1": 3, pact: 2 };
    mockPactSlotLevel = 2;
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /Pact 2nd/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), {
      type: "pact",
      level: 2,
    });
  });

  it("disables Cast with a rest hint when every slot is spent", () => {
    mockSlotState = { "1": 4, "2": 2 };
    renderDialog();
    expect(
      screen.getByText(/No available slots — take a rest/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast" })).toBeDisabled();
  });

  it("the ritual path still works when slots are exhausted", () => {
    mockSlotState = { "1": 4, "2": 2 };
    renderDialog(mkSpell({ ritual: true }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Cast" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), { type: "ritual" });
  });

  it("ritual-only mode locks the ritual path on", () => {
    renderDialog(
      mkSpell({ ritual: true }, { is_prepared: false }),
      "ritual-only",
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(
      screen.getByText(/castable only as a ritual from the spellbook/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), { type: "ritual" });
  });

  it("hides the ritual toggle for non-ritual spells", () => {
    renderDialog();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("warns when casting will replace active concentration", () => {
    mockConcentration = {
      spell_slug: "bless",
      spell_name: "Bless",
      slot_level: 1,
      started_at: new Date().toISOString(),
    };
    renderDialog(mkSpell({ concentration: true }));
    expect(screen.getByText(/casting will end/i)).toBeInTheDocument();
    expect(screen.getByText("Bless")).toBeInTheDocument();
  });

  it("cantrips skip the slot picker and scale by character level", () => {
    renderDialog(
      mkSpell({
        level: 0,
        damage: {
          type: "fire",
          dice_at_slot_level: { "1": "1d10", "5": "2d10" },
        },
        dc: null,
      }),
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByText(/no spell slot required/i)).toBeInTheDocument();
    // Character level 3 → tier 1 damage.
    expect(screen.getByText(/1d10\s*fire damage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), { type: "cantrip" });
  });

  it("casts with the selected leveled slot", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /2nd/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(castSpell).toHaveBeenCalledWith(expect.anything(), {
      type: "slot",
      level: 2,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument(),
    );
  });
});

// ---------------------------------------------------------------------------
// Result pane
// ---------------------------------------------------------------------------

describe("CastDialog — result pane", () => {
  async function castAndGetResultPane(outcome: CastOutcome) {
    castSpell.mockResolvedValue(outcome);
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument(),
    );
  }

  it("offers exactly the returned roll requests", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          {
            kind: "attack",
            label: "Burning Hands — Attack",
            expression: "1d20+5",
          },
          {
            kind: "damage",
            label: "Burning Hands — Damage",
            expression: "3d6",
          },
        ],
      }),
    );
    expect(screen.getByRole("button", { name: /Roll Attack/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Advantage/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disadvantage/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Roll Damage \(3d6\)/ })).toBeInTheDocument();
  });

  it("rolls through useRolls and shows the total", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "damage", label: "Burning Hands — Damage", expression: "3d6" },
        ],
      }),
    );
    roll.mockReturnValue(mkRollResult({ total: 11, natural: undefined }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Damage/ }));
    expect(roll).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "damage", expression: "3d6" }),
    );
    expect(screen.getByText("→ 11")).toBeInTheDocument();
  });

  it("advantage attack rolls pass the mode through", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "attack", label: "A", expression: "1d20+5" },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Advantage" }));
    expect(roll).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "advantage" }),
    );
  });

  it("a natural 20 attack arms the damage roll with crit", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "attack", label: "A", expression: "1d20+5" },
          { kind: "damage", label: "D", expression: "3d6" },
        ],
      }),
    );
    roll.mockReturnValue(mkRollResult({ natural: 20, total: 25 }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Attack/ }));
    expect(screen.getByText(/critical hit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Roll Damage/ }));
    expect(roll).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "damage", crit: true }),
    );
  });

  it("a normal hit does not arm crit", async () => {
    await castAndGetResultPane(
      mkOutcome({
        rollRequests: [
          { kind: "attack", label: "A", expression: "1d20+5" },
          { kind: "damage", label: "D", expression: "3d6" },
        ],
      }),
    );
    roll.mockReturnValue(mkRollResult({ natural: 12 }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Attack/ }));
    fireEvent.click(screen.getByRole("button", { name: /Roll Damage/ }));
    const lastCall = roll.mock.calls.at(-1)![0];
    expect(lastCall.crit).toBeUndefined();
  });

  it("shows the applied active effect and closes on Done", async () => {
    const { ...rest } = mkOutcome({
      activeEffect: {
        id: "e1",
        name: "Mage Armor",
        slug: "mage-armor",
        source: "spell",
        content_id: "c1",
        effects: [],
        duration: { type: "hours", value: 8 },
        concentration: false,
        applied_at: new Date().toISOString(),
        expires_at: null,
      },
    });
    castSpell.mockResolvedValue(rest);
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    await waitFor(() =>
      expect(
        screen.getByText(/Mage Armor added to Active Effects/),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });
});
