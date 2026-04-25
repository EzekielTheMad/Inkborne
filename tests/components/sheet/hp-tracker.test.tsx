import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HPTracker } from "@/components/sheet/hp-tracker";

interface SetupOpts {
  currentHp: number;
  maxHp: number;
  tempHp?: number;
}

function setup({ currentHp, maxHp, tempHp = 0 }: SetupOpts) {
  const patchState = vi.fn().mockResolvedValue(undefined);
  render(
    <HPTracker
      currentHp={currentHp}
      maxHp={maxHp}
      tempHp={tempHp}
      patchState={patchState}
    />,
  );
  return { patchState };
}

async function openAndApply(buttonName: RegExp, amount: string) {
  fireEvent.click(screen.getByRole("button", { name: /hp tracker/i }));
  const input = await screen.findByPlaceholderText("Amount");
  fireEvent.change(input, { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HPTracker — death-save auto-reset on 0→>0 (PR #17)", () => {
  it("clears death saves when healing from 0 to >0", async () => {
    const { patchState } = setup({ currentHp: 0, maxHp: 10 });
    await openAndApply(/^heal$/i, "1");
    expect(patchState).toHaveBeenCalledWith({
      current_hp: 1,
      death_saves: { successes: 0, failures: 0 },
    });
  });

  it("does not include death_saves when healing from >0 to >0", async () => {
    const { patchState } = setup({ currentHp: 5, maxHp: 10 });
    await openAndApply(/^heal$/i, "5");
    expect(patchState).toHaveBeenCalledWith({ current_hp: 10 });
    const patch = patchState.mock.calls[0][0];
    expect(patch).not.toHaveProperty("death_saves");
  });

  it("does not include death_saves on damage that drops HP to 0", async () => {
    // Damage path uses patchState directly; the death-save reset only fires on
    // heal. Verifies the trigger condition is one-directional.
    const { patchState } = setup({ currentHp: 5, maxHp: 10 });
    await openAndApply(/^damage$/i, "5");
    expect(patchState).toHaveBeenCalledWith({ current_hp: 0, temp_hp: 0 });
    const patch = patchState.mock.calls[0][0];
    expect(patch).not.toHaveProperty("death_saves");
  });

  it("still patches death_saves on 0→>0 even if saves are already zero (idempotent by design)", async () => {
    // The component does not read current saves before patching — it just
    // writes {0, 0} on the transition. The patch is idempotent in this case
    // but we lock in the behavior so a future refactor doesn't silently
    // change it.
    const { patchState } = setup({ currentHp: 0, maxHp: 10 });
    await openAndApply(/^heal$/i, "1");
    expect(patchState).toHaveBeenCalledWith({
      current_hp: 1,
      death_saves: { successes: 0, failures: 0 },
    });
  });

  it("does not include death_saves when setting temp HP from 0", async () => {
    // Temp HP path is independent of current HP, so even though we're at 0
    // it shouldn't clear death saves.
    const { patchState } = setup({ currentHp: 0, maxHp: 10 });
    await openAndApply(/set temp hp/i, "3");
    expect(patchState).toHaveBeenCalledWith({ temp_hp: 3 });
    const patch = patchState.mock.calls[0][0];
    expect(patch).not.toHaveProperty("death_saves");
  });
});
