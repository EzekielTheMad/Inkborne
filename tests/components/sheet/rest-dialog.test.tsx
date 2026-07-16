import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RestDialog } from "@/components/sheet/rest-dialog";
import type { HitDicePool } from "@/lib/hit-dice/helpers";

interface RestHookMock {
  shortRest: ReturnType<typeof vi.fn>;
  longRest: ReturnType<typeof vi.fn>;
  canShortRest: boolean;
  canLongRest: boolean;
  exhaustion: number;
  setExhaustion: ReturnType<typeof vi.fn>;
  hitDicePools: HitDicePool[];
  spendHitDie: ReturnType<typeof vi.fn>;
}

let mockUseRest: () => RestHookMock;
let mockState: Record<string, unknown> = { current_hp: 30 };

function buildMock(overrides: Partial<RestHookMock> = {}): RestHookMock {
  return {
    shortRest: vi.fn(),
    longRest: vi.fn(),
    canShortRest: true,
    canLongRest: true,
    exhaustion: 0,
    setExhaustion: vi.fn(),
    hitDicePools: [],
    spendHitDie: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

vi.mock("@/lib/character/character-context", () => ({
  useRest: () => mockUseRest(),
  useCharacter: () => ({
    character: {},
    maxHp: 50,
  }),
  useCharacterState: () => ({ state: mockState }),
  useResources: () => ({ resources: [], uses: {}, spend: vi.fn(), restore: vi.fn(), setUsed: vi.fn() }),
}));

function setup(
  overrides: Partial<RestHookMock> = {},
  state: Record<string, unknown> = { current_hp: 30 },
) {
  mockState = state;
  const mock = buildMock(overrides);
  mockUseRest = () => mock;
  const onClose = vi.fn();
  render(<RestDialog open={true} onClose={onClose} />);
  return { ...mock, onClose };
}

describe("RestDialog", () => {
  it("renders two panes with Short Rest and Long Rest buttons", () => {
    setup();
    expect(screen.getByRole("button", { name: /take short rest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take long rest/i })).toBeInTheDocument();
  });

  it("disables Short Rest button when canShortRest is false", () => {
    setup({ canShortRest: false });
    expect(screen.getByRole("button", { name: /take short rest/i })).toBeDisabled();
  });

  it("disables Long Rest button when canLongRest is false", () => {
    setup({ canLongRest: false });
    expect(screen.getByRole("button", { name: /take long rest/i })).toBeDisabled();
  });

  it("calls shortRest() and onClose when short rest button clicked", () => {
    const { shortRest, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: /take short rest/i }));
    expect(shortRest).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls longRest() and onClose when long rest button clicked", () => {
    const { longRest, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: /take long rest/i }));
    expect(longRest).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'No short-rest recovery available' when no pact slots used and no short-rest resources", () => {
    setup();
    expect(screen.getByText(/no short-rest recovery available/i)).toBeInTheDocument();
  });
});

describe("RestDialog — hit dice section", () => {
  const pools: HitDicePool[] = [
    { classSlug: "fighter", die: 10, max: 3, spent: 1 },
    { classSlug: "wizard", die: 6, max: 2, spent: 0 },
  ];

  it("hides the Hit Dice section when there are no pools", () => {
    setup();
    expect(screen.queryByText(/hit dice/i)).not.toBeInTheDocument();
  });

  it("renders one row per class pool with remaining counts", () => {
    setup({ hitDicePools: pools });
    expect(screen.getByText("Hit Dice")).toBeInTheDocument();
    expect(screen.getByText(/fighter d10/i)).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText(/wizard d6/i)).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("Spend & Roll calls spendHitDie with the class slug and does NOT close the dialog", () => {
    const { spendHitDie, onClose } = setup({ hitDicePools: pools });
    const buttons = screen.getAllByRole("button", { name: /spend & roll/i });
    fireEvent.click(buttons[0]);
    expect(spendHitDie).toHaveBeenCalledWith("fighter");
    fireEvent.click(buttons[1]);
    expect(spendHitDie).toHaveBeenCalledWith("wizard");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables Spend & Roll for a pool with 0 remaining", () => {
    setup({
      hitDicePools: [{ classSlug: "fighter", die: 10, max: 3, spent: 3 }],
    });
    const button = screen.getByRole("button", { name: /spend & roll/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "No hit dice remaining");
  });

  it("disables every Spend & Roll button when HP is full", () => {
    setup({ hitDicePools: pools }, { current_hp: 50 });
    const buttons = screen.getAllByRole("button", { name: /spend & roll/i });
    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "HP is already full");
    }
  });

  it("enables Spend & Roll when dice remain and HP is below max", () => {
    setup({ hitDicePools: pools });
    const buttons = screen.getAllByRole("button", { name: /spend & roll/i });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeEnabled();
  });

  it("previews long-rest HD recovery (⌊total/2⌋ min 1)", () => {
    // Fighter 3/Wizard 2 all spent → 5 HD → recover 2.
    setup({
      hitDicePools: [
        { classSlug: "fighter", die: 10, max: 3, spent: 3 },
        { classSlug: "wizard", die: 6, max: 2, spent: 2 },
      ],
    });
    expect(screen.getByText(/recover 2 hit dice/i)).toBeInTheDocument();
  });

  it("uses singular wording when exactly 1 die recovers", () => {
    setup({
      hitDicePools: [{ classSlug: "wizard", die: 6, max: 1, spent: 1 }],
    });
    expect(screen.getByText(/recover 1 hit die/i)).toBeInTheDocument();
  });

  it("omits the recovery preview when nothing is spent", () => {
    setup({
      hitDicePools: [{ classSlug: "fighter", die: 10, max: 3, spent: 0 }],
    });
    expect(screen.queryByText(/recover .* hit d/i)).not.toBeInTheDocument();
  });
});
