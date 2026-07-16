import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeathSaves } from "@/components/sheet/death-saves";
import type { RollRequest, RollResult } from "@/lib/dice/types";
import type { CharacterDeathSaves } from "@/lib/types/character";

const rollMock = vi.fn();

vi.mock("@/lib/character/character-context", () => ({
  useRolls: () => ({ rolls: [], roll: rollMock }),
  useActiveEffects: () => ({
    activeEffects: [],
    applyEffect: vi.fn(),
    removeEffect: vi.fn(),
    addCustomEffect: vi.fn(),
  }),
}));

/** Seed the next roll: the mock returns a d20 face + total. */
function seedRoll(natural: number, total = natural) {
  rollMock.mockImplementation(
    (request: RollRequest): RollResult => ({
      request,
      groups: [{ sides: 20, rolls: [natural], kept: [natural] }],
      modifier: 0,
      total,
      natural,
      rolled_at: "2026-07-16T12:00:00.000Z",
    }),
  );
}

function setup(deathSaves: CharacterDeathSaves, currentHp = 0) {
  const patchState = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <DeathSaves currentHp={currentHp} deathSaves={deathSaves} patchState={patchState} />,
  );
  return { patchState, ...utils };
}

async function rollDeathSave() {
  fireEvent.click(screen.getByRole("button", { name: "Roll death save" }));
  fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<DeathSaves> — RAW rolled saves (design D9)", () => {
  it("renders nothing when HP > 0", () => {
    const { container } = setup({ successes: 1, failures: 1 }, 5);
    expect(container).toBeEmptyDOMElement();
  });

  it("rolls a bare 1d20 with kind death_save", async () => {
    seedRoll(14);
    setup({ successes: 0, failures: 0 });
    await rollDeathSave();
    expect(rollMock).toHaveBeenCalledWith({
      kind: "death_save",
      label: "Death Save",
      expression: "1d20",
    });
  });

  it("10+ marks one success in a single patch", async () => {
    seedRoll(14);
    const { patchState } = setup({ successes: 1, failures: 1 });
    await rollDeathSave();
    expect(patchState).toHaveBeenCalledTimes(1);
    expect(patchState).toHaveBeenCalledWith({
      death_saves: { successes: 2, failures: 1 },
    });
  });

  it("below 10 marks one failure", async () => {
    seedRoll(7);
    const { patchState } = setup({ successes: 0, failures: 0 });
    await rollDeathSave();
    expect(patchState).toHaveBeenCalledTimes(1);
    expect(patchState).toHaveBeenCalledWith({
      death_saves: { successes: 0, failures: 1 },
    });
  });

  it("natural 1 adds two failures", async () => {
    seedRoll(1);
    const { patchState } = setup({ successes: 2, failures: 0 });
    await rollDeathSave();
    expect(patchState).toHaveBeenCalledTimes(1);
    expect(patchState).toHaveBeenCalledWith({
      death_saves: { successes: 2, failures: 2 },
    });
  });

  it("natural 20 revives at 1 HP and resets saves — one atomic patch", async () => {
    seedRoll(20);
    const { patchState } = setup({ successes: 1, failures: 2 });
    await rollDeathSave();
    expect(patchState).toHaveBeenCalledTimes(1);
    expect(patchState).toHaveBeenCalledWith({
      current_hp: 1,
      death_saves: { successes: 0, failures: 0 },
    });
  });

  it("offers advantage/disadvantage in the popover (d20 kind)", async () => {
    seedRoll(11);
    const { patchState } = setup({ successes: 0, failures: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Roll death save" }));
    fireEvent.click(await screen.findByRole("button", { name: "Advantage" }));
    expect(rollMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "death_save", mode: "advantage" }),
    );
    expect(patchState).toHaveBeenCalledWith({
      death_saves: { successes: 1, failures: 0 },
    });
  });

  it("hides the roll button once stabilized", () => {
    setup({ successes: 3, failures: 0 });
    expect(
      screen.queryByRole("button", { name: "Roll death save" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Stabilized")).toBeInTheDocument();
  });

  it("hides the roll button once dead", () => {
    setup({ successes: 0, failures: 3 });
    expect(
      screen.queryByRole("button", { name: "Roll death save" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Dead")).toBeInTheDocument();
  });
});

describe("<DeathSaves> — manual pips stay for table adjudication", () => {
  it("clicking a success pip increments successes", () => {
    const { patchState } = setup({ successes: 0, failures: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Success 1 (empty)" }));
    expect(patchState).toHaveBeenCalledWith({
      death_saves: { successes: 1, failures: 0 },
    });
  });

  it("clicking a failure pip increments failures", () => {
    const { patchState } = setup({ successes: 0, failures: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Failure 1 (filled)" }));
    expect(patchState).toHaveBeenCalledWith({
      death_saves: { successes: 0, failures: 2 },
    });
  });
});
