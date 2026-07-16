import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConcentrationBadge } from "@/components/sheet/spells/concentration-badge";
import type { ActiveEffect } from "@/lib/types/active-effects";
import type { ConcentrationState } from "@/lib/types/spells";

let mockConcentration: ConcentrationState | null = null;
let mockActiveEffects: ActiveEffect[] = [];
const setConcentration = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/character/character-context", () => ({
  useSpells: () => ({
    concentration: mockConcentration,
    setConcentration,
  }),
  useActiveEffects: () => ({ activeEffects: mockActiveEffects }),
}));

const mkEffect = (overrides: Partial<ActiveEffect> = {}): ActiveEffect => ({
  id: "e1",
  name: "Bless",
  slug: "bless",
  source: "spell",
  content_id: "c1",
  effects: [],
  duration: { type: "minutes", value: 1 },
  concentration: true,
  applied_at: "2026-07-15T12:00:00.000Z",
  expires_at: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockConcentration = {
    spell_slug: "bless",
    spell_name: "Bless",
    slot_level: 1,
    started_at: "2026-07-15T12:00:00.000Z",
  };
  mockActiveEffects = [];
});

describe("ConcentrationBadge", () => {
  it("renders nothing when not concentrating", () => {
    mockConcentration = null;
    const { container } = render(<ConcentrationBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the concentration-linked effects that ending will remove", () => {
    mockActiveEffects = [
      mkEffect(),
      mkEffect({ id: "e2", name: "Mage Armor", concentration: false }),
    ];
    render(<ConcentrationBadge />);
    expect(screen.getByText(/ending removes bless/i)).toBeInTheDocument();
    expect(screen.queryByText(/mage armor/i)).not.toBeInTheDocument();
  });

  it("omits the removal listing when no effects are linked", () => {
    render(<ConcentrationBadge />);
    expect(screen.queryByText(/ending removes/i)).not.toBeInTheDocument();
  });

  it("ends concentration via setConcentration(null) — which applies the atomic drop patch", () => {
    mockActiveEffects = [mkEffect()];
    render(<ConcentrationBadge />);
    fireEvent.click(screen.getByRole("button", { name: /end concentration/i }));
    expect(setConcentration).toHaveBeenCalledWith(null);
  });
});
