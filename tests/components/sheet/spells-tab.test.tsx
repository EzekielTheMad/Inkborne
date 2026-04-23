import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpellsTab } from "@/components/sheet/tabs/spells-tab";

vi.mock("@/lib/character/character-context", () => {
  return {
    useCharacter: () => ({
      character: { id: "c1", name: "Test", system_id: "sys", choices: {} },
    }),
    useSpells: () => useSpellsMock(),
  };
});

let useSpellsMockData: ReturnType<typeof buildMock>;
function useSpellsMock() {
  return useSpellsMockData;
}

function buildMock(overrides: Partial<ReturnType<typeof buildMock>> = {}) {
  return {
    casterInfo: { isCaster: false, classes: [], spellDc: 0, spellAttackBonus: 0 },
    spells: [],
    slotState: {},
    maxSlots: {},
    concentration: null,
    addSpell: vi.fn(),
    updateSpell: vi.fn(),
    removeSpell: vi.fn(),
    setConcentration: vi.fn(),
    ...overrides,
  };
}

describe("SpellsTab", () => {
  it("renders non-caster message when isCaster is false", () => {
    useSpellsMockData = buildMock({
      casterInfo: { isCaster: false, classes: [], spellDc: 0, spellAttackBonus: 0 },
    });
    render(<SpellsTab />);
    expect(screen.getByText(/cannot cast spells/i)).toBeInTheDocument();
  });

  it("renders empty-state prompt for caster with no spells", () => {
    useSpellsMockData = buildMock({
      casterInfo: {
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
      },
    });
    render(<SpellsTab />);
    expect(screen.getByText(/haven't picked any spells yet/i)).toBeInTheDocument();
  });

  it("shows the Add Spell button for casters", () => {
    useSpellsMockData = buildMock({
      casterInfo: {
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
      },
    });
    render(<SpellsTab />);
    expect(screen.getByRole("button", { name: /add spell/i })).toBeInTheDocument();
  });
});
