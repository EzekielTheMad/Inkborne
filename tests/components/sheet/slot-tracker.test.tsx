import { classDataSchema } from "@/lib/schemas/content-types/class";
import { resolveSpellSlots } from "@/lib/spells/helpers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import type { MaxSlotsByLevel, SpellSlotsUsed } from "@/lib/types/spells";
import type { CharacterState } from "@/lib/types/character";

const patchState = vi.fn<(patch: Partial<CharacterState>) => Promise<void>>();

let mockIsOwner = true;
let mockMaxSlots: MaxSlotsByLevel = {};
let mockSlotState: SpellSlotsUsed = {};

vi.mock("@/lib/character/character-context", () => ({
  useCharacter: () => ({ isOwner: mockIsOwner }),
  useSpells: () => ({ slotResolution: { status: "available", maxSlots: mockMaxSlots, pactSlotLevel: null },
    maxSlots: mockMaxSlots, slotState: mockSlotState }),
  useCharacterState: () => ({
    state: { spell_slots_used: mockSlotState },
    patchState: { runAction: (_state: CharacterState, compute: (state: CharacterState) => { patch: Partial<CharacterState>; result: boolean }) => {
      const result = compute({ spell_slots_used: mockSlotState });
      return patchState(result.patch).then(() => result.result);
    } },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockIsOwner = true;
  patchState.mockResolvedValue(undefined);
  mockMaxSlots = { "1": 3, "2": 2 };
  mockSlotState = { "1": 1 };
});

function canonicalLargePool() {
  const data = classDataSchema.parse({ hit_die: 6, spellcasting: { type: "full", ability: "intelligence" },
    multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
    levels: [{ level: 1, features: [], spellcasting: { spell_slots: [4294967296, 0, 0, 0, 0, 0, 0, 0, 0] } }] });
  const result = resolveSpellSlots([{ slug: "local-caster", level: 1 }], { "local-caster": data });
  expect(result.status).toBe("available");
  if (result.status !== "available") throw new Error(result.reason);
  mockMaxSlots = result.maxSlots; mockSlotState = {};
}

describe("SlotTracker", () => {
  it("renders an actual-canonical large pool without allocating one dot per slot", () => {
    canonicalLargePool(); render(<SlotTracker />);
    expect(screen.getByText("4294967296/4294967296")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Mark 1st slot used" }));
    expect(patchState).toHaveBeenCalledWith({ spell_slots_used: { "1": 1 } });
  });
  it("keeps a large exhausted pool's full count and only offers restoration", () => {
    canonicalLargePool(); mockSlotState = { "1": 4294967296 }; render(<SlotTracker />);
    expect(screen.getByText("0/4294967296")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark 1st slot used" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Restore 1st slot" }));
    expect(patchState).toHaveBeenCalledWith({ spell_slots_used: { "1": 4294967295 } });
  });
  it("shows a read-only large count with disabled controls", () => {
    canonicalLargePool(); mockIsOwner = false; mockSlotState = { "1": 1 }; render(<SlotTracker />);
    expect(screen.getByText("4294967295/4294967296")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(patchState).not.toHaveBeenCalled();
  });
  it("disables both large-pool steps until the current save settles", async () => {
    canonicalLargePool(); let finish!: () => void;
    patchState.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<SlotTracker />); fireEvent.click(screen.getByRole("button", { name: "Mark 1st slot used" }));
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Mark 1st slot used" })).toBeEnabled();
  });
  it("keeps ordinary dot controls read-only for viewers", () => {
    mockIsOwner = false; render(<SlotTracker />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(patchState).not.toHaveBeenCalled();
  });

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
