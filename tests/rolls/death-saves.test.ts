import { describe, it, expect } from "vitest";
import { resolveDeathSave } from "@/lib/rolls/death-saves";

describe("resolveDeathSave (RAW, design D9)", () => {
  it("total ≥ 10 → one success", () => {
    const { outcome, patch } = resolveDeathSave(
      { successes: 0, failures: 1 },
      { natural: 14, total: 14 },
    );
    expect(outcome).toBe("success");
    expect(patch).toEqual({ death_saves: { successes: 1, failures: 1 } });
  });

  it("total of exactly 10 succeeds", () => {
    const { outcome } = resolveDeathSave(
      { successes: 0, failures: 0 },
      { natural: 10, total: 10 },
    );
    expect(outcome).toBe("success");
  });

  it("total < 10 → one failure", () => {
    const { outcome, patch } = resolveDeathSave(
      { successes: 2, failures: 0 },
      { natural: 7, total: 7 },
    );
    expect(outcome).toBe("failure");
    expect(patch).toEqual({ death_saves: { successes: 2, failures: 1 } });
  });

  it("natural 1 → two failures", () => {
    const { outcome, patch } = resolveDeathSave(
      { successes: 1, failures: 0 },
      { natural: 1, total: 1 },
    );
    expect(outcome).toBe("critical_failure");
    expect(patch).toEqual({ death_saves: { successes: 1, failures: 2 } });
  });

  it("natural 1 clamps failures at 3 (2 + 2 → 3, dead)", () => {
    const { patch } = resolveDeathSave(
      { successes: 0, failures: 2 },
      { natural: 1, total: 1 },
    );
    expect(patch).toEqual({ death_saves: { successes: 0, failures: 3 } });
  });

  it("natural 20 → regain 1 HP with saves reset, in one patch", () => {
    const { outcome, patch } = resolveDeathSave(
      { successes: 2, failures: 2 },
      { natural: 20, total: 20 },
    );
    expect(outcome).toBe("revive");
    expect(patch).toEqual({
      current_hp: 1,
      death_saves: { successes: 0, failures: 0 },
    });
  });

  it("decides success on TOTAL, not natural — a Bless rider can turn a 9 into a 10", () => {
    // d20 face 9 + 1d4 (Bless) rider = total 10.
    const { outcome } = resolveDeathSave(
      { successes: 0, failures: 0 },
      { natural: 9, total: 10 },
    );
    expect(outcome).toBe("success");
  });

  it("clamps successes at 3", () => {
    const { patch } = resolveDeathSave(
      { successes: 3, failures: 0 },
      { natural: 15, total: 15 },
    );
    expect(patch).toEqual({ death_saves: { successes: 3, failures: 0 } });
  });

  it("a missing natural (defensive) falls back to the total thresholds", () => {
    expect(
      resolveDeathSave({ successes: 0, failures: 0 }, { total: 12 }).outcome,
    ).toBe("success");
    expect(
      resolveDeathSave({ successes: 0, failures: 0 }, { total: 3 }).outcome,
    ).toBe("failure");
  });
});
