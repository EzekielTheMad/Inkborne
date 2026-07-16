import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import type { MaxSlotsByLevel, SpellSlotsUsed } from "@/lib/types/spells";
import type { CharacterState } from "@/lib/types/character";

const patchState = vi.fn<(patch: Partial<CharacterState>) => Promise<void>>();

let mockMaxSlots: MaxSlotsByLevel = {};
let mockSlotState: SpellSlotsUsed = {};

vi.mock("@/lib/character/character-context", () => ({
  useSpells: () => ({ maxSlots: mockMaxSlots, slotState: mockSlotState }),
  useCharacterState: () => ({ patchState }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  patchState.mockResolvedValue(undefined);
  mockMaxSlots = { "1": 3, "2": 2 };
  mockSlotState = { "1": 1 };
});

describe("SlotTracker", () => {
  it("renders nothing without slots", () => {
    mockMaxSlots = {};
    const { container } = render(<SlotTracker />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows free/total per level", () => {
    render(<SlotTracker />);
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("clicking an available dot marks a slot used", () => {
    render(<SlotTracker />);
    // 1st level: 3 total, 1 used → 2 available dots.
    const availableDots = screen.getAllByRole("button", {
      name: "Mark 1st slot used",
    });
    expect(availableDots).toHaveLength(2);
    availableDots[0].click();
    expect(patchState).toHaveBeenCalledWith({
      spell_slots_used: { "1": 2 },
    });
  });

  it("clicking a used dot restores the slot", () => {
    render(<SlotTracker />);
    const usedDots = screen.getAllByRole("button", {
      name: "Restore 1st slot",
    });
    expect(usedDots).toHaveLength(1);
    usedDots[0].click();
    expect(patchState).toHaveBeenCalledWith({
      spell_slots_used: { "1": 0 },
    });
  });

  it("preserves other slot keys when toggling", () => {
    mockSlotState = { "1": 1, "2": 2, pact: 1 };
    mockMaxSlots = { "1": 3, "2": 2, pact: 2 };
    render(<SlotTracker />);
    screen.getAllByRole("button", { name: "Mark 1st slot used" })[0].click();
    expect(patchState).toHaveBeenCalledWith({
      spell_slots_used: { "1": 2, "2": 2, pact: 1 },
    });
  });

  it("renders pact slots with their own row", () => {
    mockMaxSlots = { pact: 2 };
    mockSlotState = {};
    render(<SlotTracker />);
    expect(screen.getByText("Pact")).toBeInTheDocument();
    screen.getAllByRole("button", { name: "Mark Pact slot used" })[0].click();
    expect(patchState).toHaveBeenCalledWith({
      spell_slots_used: { pact: 1 },
    });
  });

  it("clamps stale used counts to the total on display", () => {
    mockSlotState = { "1": 9 };
    render(<SlotTracker />);
    expect(screen.getByText("0/3")).toBeInTheDocument();
    // Every dot is a restore at that point.
    expect(
      screen.getAllByRole("button", { name: "Restore 1st slot" }),
    ).toHaveLength(3);
  });
});
