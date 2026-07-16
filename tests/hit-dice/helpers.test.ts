import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeHitDicePools,
  computeLongRestHdRecovery,
  buildHitDieRollRequest,
  spendHitDiePatch,
  formatClassSlug,
  type HitDicePool,
} from "@/lib/hit-dice/helpers";
import { parseDiceExpression } from "@/lib/dice/parser";
import type { CharacterState } from "@/lib/types/character";

const classContent = {
  fighter: { data: { hit_die: 10 } },
  wizard: { data: { hit_die: 6 } },
  barbarian: { data: { hit_die: 12 } },
};

const pool = (
  classSlug: string,
  die: number,
  max: number,
  spent: number,
): HitDicePool => ({ classSlug, die, max, spent });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeHitDicePools", () => {
  it("derives one pool per class: max = class level, die from content", () => {
    const state: CharacterState = { hit_dice_spent: { fighter: 1 } };
    const pools = computeHitDicePools(
      [
        { slug: "fighter", level: 3 },
        { slug: "wizard", level: 2 },
      ],
      classContent,
      state,
    );
    expect(pools).toEqual([
      { classSlug: "fighter", die: 10, max: 3, spent: 1 },
      { classSlug: "wizard", die: 6, max: 2, spent: 0 },
    ]);
  });

  it("clamps stale spent values to max on read (self-healing after level-down)", () => {
    const state: CharacterState = { hit_dice_spent: { fighter: 7 } };
    const pools = computeHitDicePools(
      [{ slug: "fighter", level: 3 }],
      classContent,
      state,
    );
    expect(pools[0].spent).toBe(3);
  });

  it("clamps negative spent values to 0", () => {
    const state: CharacterState = { hit_dice_spent: { fighter: -2 } };
    const pools = computeHitDicePools(
      [{ slug: "fighter", level: 3 }],
      classContent,
      state,
    );
    expect(pools[0].spent).toBe(0);
  });

  it("defaults missing hit_die to d8 with a console warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pools = computeHitDicePools(
      [{ slug: "mystic", level: 2 }],
      {},
      {},
    );
    expect(pools[0].die).toBe(8);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"mystic"'),
    );
  });

  it("defaults non-numeric hit_die to d8", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const pools = computeHitDicePools(
      [{ slug: "fighter", level: 1 }],
      { fighter: { data: { hit_die: "d10" } } },
      {},
    );
    expect(pools[0].die).toBe(8);
  });

  it("returns an empty array for a classless character", () => {
    expect(computeHitDicePools([], classContent, {})).toEqual([]);
  });

  it("treats a missing hit_dice_spent map as all-unspent", () => {
    const pools = computeHitDicePools(
      [{ slug: "fighter", level: 5 }],
      classContent,
      {},
    );
    expect(pools[0]).toEqual({ classSlug: "fighter", die: 10, max: 5, spent: 0 });
  });
});

describe("computeLongRestHdRecovery", () => {
  it("restores ⌊total/2⌋ dice, largest die first (Fighter 3/Wizard 2, all spent)", () => {
    const recovery = computeLongRestHdRecovery([
      pool("fighter", 10, 3, 3),
      pool("wizard", 6, 2, 2),
    ]);
    // 5 total HD → budget 2, both from the d10 pool.
    expect(recovery).toEqual({ fighter: 2 });
  });

  it("spills the budget to the next-largest pool when the largest has less spent", () => {
    const recovery = computeLongRestHdRecovery([
      pool("fighter", 10, 3, 1),
      pool("wizard", 6, 2, 2),
    ]);
    expect(recovery).toEqual({ fighter: 1, wizard: 1 });
  });

  it("applies the min-1 floor for a level-1 character", () => {
    const recovery = computeLongRestHdRecovery([pool("wizard", 6, 1, 1)]);
    expect(recovery).toEqual({ wizard: 1 });
  });

  it("returns {} when nothing is spent (no no-op keys)", () => {
    const recovery = computeLongRestHdRecovery([
      pool("fighter", 10, 3, 0),
      pool("wizard", 6, 2, 0),
    ]);
    expect(recovery).toEqual({});
  });

  it("returns {} for empty pools", () => {
    expect(computeLongRestHdRecovery([])).toEqual({});
  });

  it("never restores more than is spent even with budget to spare", () => {
    // Level 9 barbarian → budget 4, but only 2 spent.
    const recovery = computeLongRestHdRecovery([pool("barbarian", 12, 9, 2)]);
    expect(recovery).toEqual({ barbarian: 2 });
  });

  it("orders by die size, not class order", () => {
    const recovery = computeLongRestHdRecovery([
      pool("wizard", 6, 2, 2),
      pool("barbarian", 12, 2, 2),
    ]);
    // Budget 2, all from the d12 pool despite the wizard listed first.
    expect(recovery).toEqual({ barbarian: 2 });
  });
});

describe("buildHitDieRollRequest", () => {
  it("builds 1dX+mod for a positive CON mod", () => {
    const req = buildHitDieRollRequest(pool("fighter", 10, 3, 0), 2);
    expect(req.expression).toBe("1d10+2");
    expect(req.kind).toBe("hit_die");
    expect(req.label).toContain("Fighter");
    expect(req.label).toContain("d10");
    expect(req.meta).toEqual({ class_slug: "fighter", con_mod: 2 });
  });

  it("builds 1dX-mod for a negative CON mod", () => {
    const req = buildHitDieRollRequest(pool("wizard", 6, 2, 0), -3);
    expect(req.expression).toBe("1d6-3");
  });

  it("omits the modifier entirely when the CON mod is 0", () => {
    const req = buildHitDieRollRequest(pool("wizard", 6, 2, 0), 0);
    expect(req.expression).toBe("1d6");
  });

  it("always produces a parseable expression", () => {
    for (const mod of [-5, -1, 0, 1, 5]) {
      const req = buildHitDieRollRequest(pool("fighter", 10, 3, 0), mod);
      expect(() => parseDiceExpression(req.expression)).not.toThrow();
    }
  });
});

describe("spendHitDiePatch", () => {
  it("increments the class's spent count and heals in ONE patch object", () => {
    const state: CharacterState = {
      current_hp: 10,
      hit_dice_spent: { fighter: 1, wizard: 2 },
    };
    const patch = spendHitDiePatch(state, "fighter", 7, 30);
    expect(patch).toEqual({
      hit_dice_spent: { fighter: 2, wizard: 2 },
      current_hp: 17,
    });
  });

  it("clamps healing at max HP", () => {
    const patch = spendHitDiePatch({ current_hp: 28 }, "fighter", 9, 30);
    expect(patch.current_hp).toBe(30);
    expect(patch.hit_dice_spent).toEqual({ fighter: 1 });
  });

  it("floors healing at 0 for a negative roll total (CON-mod floor) — die still spent", () => {
    const patch = spendHitDiePatch({ current_hp: 10 }, "wizard", -2, 30);
    expect(patch.current_hp).toBe(10);
    expect(patch.hit_dice_spent).toEqual({ wizard: 1 });
  });

  it("resets death saves when healing from 0 to >0 (mirrors HP tracker heal semantics)", () => {
    const patch = spendHitDiePatch({ current_hp: 0 }, "fighter", 5, 30);
    expect(patch.current_hp).toBe(5);
    expect(patch.death_saves).toEqual({ successes: 0, failures: 0 });
  });

  it("does not touch death saves when the heal amount is 0 at 0 HP", () => {
    const patch = spendHitDiePatch({ current_hp: 0 }, "wizard", -1, 30);
    expect(patch.current_hp).toBe(0);
    expect(patch).not.toHaveProperty("death_saves");
  });

  it("does not touch death saves when healing from >0", () => {
    const patch = spendHitDiePatch({ current_hp: 5 }, "fighter", 6, 30);
    expect(patch).not.toHaveProperty("death_saves");
  });

  it("defaults current_hp to maxHp when unset (stays at max)", () => {
    const patch = spendHitDiePatch({}, "fighter", 6, 30);
    expect(patch.current_hp).toBe(30);
  });

  it("starts the spent map from empty when state has none", () => {
    const patch = spendHitDiePatch({ current_hp: 1 }, "fighter", 4, 30);
    expect(patch.hit_dice_spent).toEqual({ fighter: 1 });
  });
});

describe("formatClassSlug", () => {
  it("title-cases single-word slugs", () => {
    expect(formatClassSlug("fighter")).toBe("Fighter");
  });

  it("splits dashes and title-cases each part", () => {
    expect(formatClassSlug("blood-hunter")).toBe("Blood Hunter");
  });
});
