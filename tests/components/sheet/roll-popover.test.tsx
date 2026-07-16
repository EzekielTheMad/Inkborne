import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RollPopover } from "@/components/sheet/rolls/roll-popover";
import type { RollRequest, RollResult } from "@/lib/dice/types";
import type { ActiveEffect } from "@/lib/types/active-effects";

const rollMock = vi.fn();
let mockActiveEffects: ActiveEffect[] = [];

vi.mock("@/lib/character/character-context", () => ({
  useRolls: () => ({ rolls: [], roll: rollMock }),
  useActiveEffects: () => ({
    activeEffects: mockActiveEffects,
    applyEffect: vi.fn(),
    removeEffect: vi.fn(),
    addCustomEffect: vi.fn(),
  }),
}));

function mkResult(request: RollRequest, overrides: Partial<RollResult> = {}): RollResult {
  return {
    request,
    groups: [{ sides: 20, rolls: [12], kept: [12] }],
    modifier: 5,
    total: 17,
    natural: 12,
    rolled_at: "2026-07-16T12:00:00.000Z",
    ...overrides,
  };
}

function mkBlessEffect(stat: string): ActiveEffect {
  return {
    id: "eff-1",
    name: "Bless",
    slug: "bless",
    source: "spell",
    content_id: "c-bless",
    effects: [{ type: "mechanical", stat, op: "add", value: "1d4" }],
    duration: { type: "minutes", value: 1 },
    concentration: true,
    applied_at: "2026-07-16T11:00:00.000Z",
    expires_at: null,
  } as ActiveEffect;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockActiveEffects = [];
  rollMock.mockImplementation((request: RollRequest) => mkResult(request));
});

describe("<RollPopover> — d20 kinds", () => {
  function renderCheck(props: Partial<React.ComponentProps<typeof RollPopover>> = {}) {
    return render(
      <RollPopover kind="check" label="Athletics Check" modifier={5} {...props}>
        +5
      </RollPopover>,
    );
  }

  it("opens a popover with Roll / Advantage / Disadvantage and the computed bonus", async () => {
    renderCheck();
    fireEvent.click(screen.getByRole("button", { name: "Roll Athletics Check" }));

    expect(await screen.findByRole("button", { name: "Roll" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Advantage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disadvantage" })).toBeInTheDocument();
    // Transparency line: the exact dice about to be rolled.
    expect(screen.getByText("1d20+5")).toBeInTheDocument();
  });

  it("Roll executes a normal-mode request", async () => {
    renderCheck();
    fireEvent.click(screen.getByRole("button", { name: "Roll Athletics Check" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));

    expect(rollMock).toHaveBeenCalledTimes(1);
    expect(rollMock).toHaveBeenCalledWith({
      kind: "check",
      label: "Athletics Check",
      expression: "1d20+5",
    });
  });

  it("Advantage / Disadvantage set the request mode", async () => {
    renderCheck();
    fireEvent.click(screen.getByRole("button", { name: "Roll Athletics Check" }));
    fireEvent.click(await screen.findByRole("button", { name: "Advantage" }));
    expect(rollMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: "1d20+5", mode: "advantage" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Roll Athletics Check" }));
    fireEvent.click(await screen.findByRole("button", { name: "Disadvantage" }));
    expect(rollMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "disadvantage" }),
    );
  });

  it("passes the result to onResult", async () => {
    const onResult = vi.fn();
    renderCheck({ onResult });
    fireEvent.click(screen.getByRole("button", { name: "Roll Athletics Check" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ total: 17, natural: 12 }),
    );
  });

  it("appends matching active-effect dice (Bless on an attack) with breakdown meta", async () => {
    mockActiveEffects = [mkBlessEffect("roll_attack")];
    render(
      <RollPopover kind="attack" label="Mace — Attack" modifier={7}>
        +7
      </RollPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Mace — Attack" }));
    // The popover names the rider for transparency.
    expect(await screen.findByText("1d20+7 +1d4 (Bless)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Roll" }));
    expect(rollMock).toHaveBeenCalledWith({
      kind: "attack",
      label: "Mace — Attack",
      expression: "1d20+7+1d4",
      meta: { roll_modifiers: [{ name: "Bless", dice: "1d4" }] },
    });
  });

  it("ignores non-matching riders (an attack rider does not touch a skill check)", async () => {
    mockActiveEffects = [mkBlessEffect("roll_attack")];
    renderCheck();
    fireEvent.click(screen.getByRole("button", { name: "Roll Athletics Check" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
    expect(rollMock).toHaveBeenCalledWith({
      kind: "check",
      label: "Athletics Check",
      expression: "1d20+5",
    });
  });

  it("applies save riders to death saves (RAW: death saves are saving throws)", async () => {
    mockActiveEffects = [mkBlessEffect("roll_save")];
    render(
      <RollPopover kind="death_save" label="Death Save">
        Roll Death Save
      </RollPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Death Save" }));
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
    expect(rollMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "death_save", expression: "1d20+1d4" }),
    );
  });
});

describe("<RollPopover> — immediate kinds", () => {
  it("damage rolls immediately on click, bypassing the popover", () => {
    const onResult = vi.fn();
    render(
      <RollPopover
        kind="damage"
        label="Mace — Damage"
        expression="1d6+3"
        onResult={onResult}
      >
        1d6 + 3
      </RollPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Mace — Damage" }));

    expect(rollMock).toHaveBeenCalledTimes(1);
    expect(rollMock).toHaveBeenCalledWith({
      kind: "damage",
      label: "Mace — Damage",
      expression: "1d6+3",
    });
    expect(onResult).toHaveBeenCalled();
    // No adv/dis choice for damage.
    expect(screen.queryByRole("button", { name: "Advantage" })).not.toBeInTheDocument();
  });

  it("carries crit and meta through to the request", () => {
    render(
      <RollPopover
        kind="damage"
        label="Mace — Damage"
        expression="1d6+3"
        crit
        meta={{ damage_type: "bludgeoning" }}
      >
        1d6 + 3
      </RollPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Mace — Damage" }));
    expect(rollMock).toHaveBeenCalledWith({
      kind: "damage",
      label: "Mace — Damage",
      expression: "1d6+3",
      crit: true,
      meta: { damage_type: "bludgeoning" },
    });
  });

  it("respects disabled", () => {
    render(
      <RollPopover kind="damage" label="Mace — Damage" expression="1d6+3" disabled>
        1d6 + 3
      </RollPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Mace — Damage" }));
    expect(rollMock).not.toHaveBeenCalled();
  });
});
