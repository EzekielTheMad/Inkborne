import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import {
  HPTracker,
  type HPConcentrationProps,
} from "@/components/sheet/hp-tracker";
import type { HitDicePool } from "@/lib/hit-dice/helpers";

interface SetupOpts {
  currentHp: number;
  maxHp: number;
  tempHp?: number;
  hitDicePools?: HitDicePool[];
  concentration?: HPConcentrationProps;
}

function setup({
  currentHp,
  maxHp,
  tempHp = 0,
  hitDicePools,
  concentration,
}: SetupOpts) {
  const patchState = vi.fn().mockResolvedValue(undefined);
  render(
    <HPTracker
      currentHp={currentHp}
      maxHp={maxHp}
      tempHp={tempHp}
      patchState={patchState}
      hitDicePools={hitDicePools}
      concentration={concentration}
    />,
  );
  return { patchState };
}

async function openAndApply(buttonName: RegExp, amount: string) {
  fireEvent.click(screen.getByRole("button", { name: /hp tracker/i }));
  const input = await screen.findByPlaceholderText("Amount");
  fireEvent.change(input, { target: { value: amount } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: buttonName })); });
}

describe("HPTracker pending saves", () => {
  it.each(["Damage", "Heal", "Set Temp HP"])("routes %s through its relative or absolute save contract", async (action) => {
    const absolute = vi.fn().mockResolvedValue(true);
    const relative = vi.fn().mockRejectedValue(new Error("Still saving"));
    render(<HPTracker currentHp={10} maxHp={20} tempHp={0} patchState={absolute} patchActionState={relative} />);
    await openAndApply(new RegExp(`^${action}$`), "3");
    if (action === "Set Temp HP") {
      expect(absolute).toHaveBeenCalledWith({ temp_hp: 3 });
      expect(relative).not.toHaveBeenCalled();
    } else {
      expect(relative).toHaveBeenCalledOnce();
      expect(absolute).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
      expect(screen.getByPlaceholderText("Amount")).toHaveValue(3);
    }
  });

  it("blocks repeated damage and competing actions until confirmation", async () => {
    let resolve!: (saved: boolean) => void;
    const { patchState } = setup({ currentHp: 20, maxHp: 20 });
    patchState.mockReturnValueOnce(new Promise<boolean>((yes) => { resolve = yes; }));
    await openAndApply(/^damage$/i, "4");
    expect(screen.getByRole("button", { name: "Damage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Heal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Set Temp HP" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Amount")).toBeDisabled();
    fireEvent.keyDown(screen.getByPlaceholderText("Amount"), { key: "Escape" });
    expect(screen.getByPlaceholderText("Amount")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Damage" }));
    expect(patchState).toHaveBeenCalledOnce();
    await act(async () => resolve(true));
    await waitFor(() => expect(screen.queryByPlaceholderText("Amount")).not.toBeInTheDocument());
  });

  it.each(["Heal", "Set Temp HP"])("keeps failed %s open for retry", async (action) => {
    const { patchState } = setup({ currentHp: 5, maxHp: 20 });
    patchState.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await openAndApply(new RegExp(`^${action}$`), "4");
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(screen.getByPlaceholderText("Amount")).toHaveValue(4);
    fireEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByPlaceholderText("Amount")).not.toBeInTheDocument());
    expect(patchState).toHaveBeenCalledTimes(2);
    expect(patchState.mock.calls[1][0]).toEqual(patchState.mock.calls[0][0]);
  });

  it("handles a rejected damage save without losing the amount or concentration", async () => {
    const concentration = { spellName: "Bless", dropPatch: {}, onDamage: vi.fn() };
    const { patchState } = setup({ currentHp: 20, maxHp: 20, concentration });
    patchState.mockRejectedValueOnce(new Error("private database details"));
    await openAndApply(/^damage$/i, "4");
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private database details");
    expect(screen.getByPlaceholderText("Amount")).toHaveValue(4);
    expect(concentration.onDamage).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HPTracker - death-save auto-reset on 0→>0 (PR #17)", () => {
  it("keeps failed damage open without raising a concentration check", async () => {
    const concentration = { spellName: "Bless", dropPatch: {}, onDamage: vi.fn() };
    const { patchState } = setup({ currentHp: 20, maxHp: 20, concentration });
    patchState.mockResolvedValueOnce(false);
    await openAndApply(/^damage$/i, "4");
    expect(concentration.onDamage).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Amount")).toHaveValue(4);
  });
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

describe("HPTracker — concentration damage path (M3 T7)", () => {
  const DROP_PATCH = {
    active_effects: [],
    concentrating_on: null,
  };

  function mkConcentration(): HPConcentrationProps {
    return {
      spellName: "Bless",
      dropPatch: DROP_PATCH,
      onDamage: vi.fn(),
    };
  }

  it("raises the CON-save callback when damage leaves HP above 0", async () => {
    const concentration = mkConcentration();
    const { patchState } = setup({ currentHp: 20, maxHp: 20, concentration });
    await openAndApply(/^damage$/i, "14");

    expect(concentration.onDamage).toHaveBeenCalledWith(14);
    // The damage patch itself does NOT drop concentration — that's the
    // prompt's decision.
    expect(patchState).toHaveBeenCalledWith({ current_hp: 6, temp_hp: 0 });
    const patch = patchState.mock.calls[0][0];
    expect(patch).not.toHaveProperty("concentrating_on");
    expect(patch).not.toHaveProperty("active_effects");
  });

  it("still prompts when temp HP absorbs all of the damage (RAW: temp loss is damage taken)", async () => {
    const concentration = mkConcentration();
    const { patchState } = setup({
      currentHp: 20,
      maxHp: 20,
      tempHp: 10,
      concentration,
    });
    await openAndApply(/^damage$/i, "5");

    expect(concentration.onDamage).toHaveBeenCalledWith(5);
    expect(patchState).toHaveBeenCalledWith({ current_hp: 20, temp_hp: 5 });
  });

  it("merges the drop patch into the damage patch when HP hits 0 (no prompt)", async () => {
    const concentration = mkConcentration();
    const { patchState } = setup({ currentHp: 5, maxHp: 20, concentration });
    await openAndApply(/^damage$/i, "9");

    // ONE atomic patchState: HP change + concentration drop together.
    expect(patchState).toHaveBeenCalledTimes(1);
    expect(patchState).toHaveBeenCalledWith({
      current_hp: 0,
      temp_hp: 0,
      active_effects: [],
      concentrating_on: null,
    });
    expect(concentration.onDamage).not.toHaveBeenCalled();
  });

  it("does not raise the callback on heal or temp HP changes", async () => {
    const concentration = mkConcentration();
    setup({ currentHp: 10, maxHp: 20, concentration });
    await openAndApply(/^heal$/i, "5");
    expect(concentration.onDamage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /hp tracker/i }));
    const input = await screen.findByPlaceholderText("Amount");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /set temp hp/i }));
    expect(concentration.onDamage).not.toHaveBeenCalled();
  });

  it("damage without concentration behaves exactly as before (regression guard)", async () => {
    const { patchState } = setup({ currentHp: 20, maxHp: 20 });
    await openAndApply(/^damage$/i, "14");
    expect(patchState).toHaveBeenCalledWith({ current_hp: 6, temp_hp: 0 });
  });
});

describe("HPTracker — hit dice summary line (M3 T4)", () => {
  it("shows remaining hit dice per pool in the popover", async () => {
    setup({
      currentHp: 10,
      maxHp: 20,
      hitDicePools: [
        { classSlug: "fighter", die: 10, max: 5, spent: 2 },
        { classSlug: "wizard", die: 6, max: 1, spent: 0 },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /hp tracker/i }));
    expect(
      await screen.findByText(/hit dice: d10 3\/5 · d6 1\/1/i),
    ).toBeInTheDocument();
  });

  it("omits the line when no pools are provided", async () => {
    setup({ currentHp: 10, maxHp: 20 });
    fireEvent.click(screen.getByRole("button", { name: /hp tracker/i }));
    await screen.findByPlaceholderText("Amount");
    expect(screen.queryByText(/hit dice:/i)).not.toBeInTheDocument();
  });

  it("omits the line when pools are empty", async () => {
    setup({ currentHp: 10, maxHp: 20, hitDicePools: [] });
    fireEvent.click(screen.getByRole("button", { name: /hp tracker/i }));
    await screen.findByPlaceholderText("Amount");
    expect(screen.queryByText(/hit dice:/i)).not.toBeInTheDocument();
  });
});
