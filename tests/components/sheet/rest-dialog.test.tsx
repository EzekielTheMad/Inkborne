import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RestDialog } from "@/components/sheet/rest-dialog";

let mockUseRest: () => ReturnType<typeof buildMock>;
function buildMock(overrides: Partial<ReturnType<typeof buildMock>> = {}) {
  return {
    shortRest: vi.fn(),
    longRest: vi.fn(),
    canShortRest: true,
    canLongRest: true,
    exhaustion: 0,
    setExhaustion: vi.fn(),
    ...overrides,
  };
}

vi.mock("@/lib/character/character-context", () => ({
  useRest: () => mockUseRest(),
  useCharacter: () => ({
    character: {},
    maxHp: 50,
  }),
  useCharacterState: () => ({ state: { current_hp: 30 } }),
  useResources: () => ({ resources: [], uses: {}, spend: vi.fn(), restore: vi.fn(), setUsed: vi.fn() }),
}));

describe("RestDialog", () => {
  it("renders two panes with Short Rest and Long Rest buttons", () => {
    mockUseRest = () => buildMock();
    render(<RestDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /take short rest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take long rest/i })).toBeInTheDocument();
  });

  it("disables Short Rest button when canShortRest is false", () => {
    mockUseRest = () => buildMock({ canShortRest: false });
    render(<RestDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /take short rest/i })).toBeDisabled();
  });

  it("disables Long Rest button when canLongRest is false", () => {
    mockUseRest = () => buildMock({ canLongRest: false });
    render(<RestDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /take long rest/i })).toBeDisabled();
  });

  it("calls shortRest() and onClose when short rest button clicked", () => {
    const shortRest = vi.fn();
    const onClose = vi.fn();
    mockUseRest = () => buildMock({ shortRest });
    render(<RestDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /take short rest/i }));
    expect(shortRest).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls longRest() and onClose when long rest button clicked", () => {
    const longRest = vi.fn();
    const onClose = vi.fn();
    mockUseRest = () => buildMock({ longRest });
    render(<RestDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /take long rest/i }));
    expect(longRest).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'No short-rest recovery available' when no pact slots used and no short-rest resources", () => {
    mockUseRest = () => buildMock();
    render(<RestDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/no short-rest recovery available/i)).toBeInTheDocument();
  });
});
