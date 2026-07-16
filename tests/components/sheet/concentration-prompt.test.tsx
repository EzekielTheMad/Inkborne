import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConcentrationPrompt } from "@/components/sheet/concentration-prompt";
import type { PendingConcentrationCheck } from "@/lib/active-effects/concentration";
import type { ConcentrationState } from "@/lib/types/spells";
import type { RollRequest } from "@/lib/dice/types";

// ---------------------------------------------------------------------------
// Context mocks
// ---------------------------------------------------------------------------

let mockConcentration: ConcentrationState | null = null;
let mockPendingCheck: PendingConcentrationCheck | null = null;
const resolveCheck = vi.fn().mockResolvedValue(undefined);

// roll() echoes a controllable total so success/failure paths are exact.
let mockRollTotal = 15;
const roll = vi.fn((request: RollRequest) => ({
  request,
  groups: [{ sides: 20, rolls: [mockRollTotal], kept: [mockRollTotal] }],
  modifier: 0,
  total: mockRollTotal,
  natural: mockRollTotal,
  rolled_at: new Date().toISOString(),
}));

// CON 14 (+2), proficiency +3, proficient in CON saves → save modifier +5.
const mockEvalResult = {
  stats: { constitution: 14, constitution_mod: 2 },
  computed: { proficiency_bonus: 3 },
  grants: [
    { type: "grant", stat: "saving_throw_constitution", value: "proficient" },
  ],
};

vi.mock("@/lib/character/character-context", () => ({
  useConcentration: () => ({
    concentration: mockConcentration,
    pendingCheck: mockPendingCheck,
    requestCheck: vi.fn(),
    resolveCheck,
    dropPatch: {},
  }),
  useCharacter: () => ({ evalResult: mockEvalResult }),
  useRolls: () => ({ rolls: [], roll }),
}));

const CONCENTRATING: ConcentrationState = {
  spell_slug: "bless",
  spell_name: "Bless",
  slot_level: 1,
  started_at: "2026-07-15T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockConcentration = CONCENTRATING;
  mockPendingCheck = { damage: 22, dc: 11 };
  mockRollTotal = 15;
});

describe("ConcentrationPrompt", () => {
  it("renders nothing without a pending check", () => {
    mockPendingCheck = null;
    const { container } = render(<ConcentrationPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when not concentrating (stale check)", () => {
    mockConcentration = null;
    const { container } = render(<ConcentrationPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows damage, spell name, and the computed DC", () => {
    render(<ConcentrationPrompt />);
    expect(screen.getByText("Concentration Check")).toBeInTheDocument();
    expect(
      screen.getByText(/you took 22 damage while concentrating on/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Bless")).toBeInTheDocument();
    expect(screen.getByText(/dc 11/i)).toBeInTheDocument();
  });

  it("rolls a kind=concentration CON save with the full save modifier", () => {
    render(<ConcentrationPrompt />);
    fireEvent.click(
      screen.getByRole("button", { name: /roll con save \(\+5\)/i }),
    );
    expect(roll).toHaveBeenCalledTimes(1);
    expect(roll.mock.calls[0][0]).toMatchObject({
      kind: "concentration",
      label: "Concentration Save — Bless",
      expression: "1d20+5",
      meta: { dc: 11, damage: 22 },
    });
  });

  it("auto-resolves a successful save as keep", () => {
    mockRollTotal = 11; // meets DC 11
    render(<ConcentrationPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /roll con save/i }));
    expect(resolveCheck).toHaveBeenCalledWith("keep");
  });

  it("auto-resolves a failed save as drop", () => {
    mockRollTotal = 10; // below DC 11
    render(<ConcentrationPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /roll con save/i }));
    expect(resolveCheck).toHaveBeenCalledWith("drop");
  });

  it("supports the manual Keep override without rolling", () => {
    render(<ConcentrationPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /^keep$/i }));
    expect(roll).not.toHaveBeenCalled();
    expect(resolveCheck).toHaveBeenCalledWith("keep");
  });

  it("supports the manual Drop override without rolling", () => {
    render(<ConcentrationPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /^drop$/i }));
    expect(roll).not.toHaveBeenCalled();
    expect(resolveCheck).toHaveBeenCalledWith("drop");
  });
});
