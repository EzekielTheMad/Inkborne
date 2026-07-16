import { describe, it, expect } from "vitest";
import { executeRoll } from "@/lib/dice/roller";
import type { Rng, RollRequest } from "@/lib/dice/types";

/** Deterministic seeded RNG (mulberry32). */
function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG that yields exact die faces in order: face f on a d(sides) needs (f-1)/sides. */
function facesRng(faces: Array<[face: number, sides: number]>): Rng {
  let i = 0;
  return () => {
    const next = faces[i];
    if (!next) throw new Error("facesRng exhausted");
    i += 1;
    const [face, sides] = next;
    return (face - 1) / sides;
  };
}

const req = (overrides: Partial<RollRequest>): RollRequest => ({
  kind: "check",
  label: "Test Roll",
  expression: "1d20",
  ...overrides,
});

describe("executeRoll — totals and breakdown", () => {
  it("totals kept dice plus modifier", () => {
    const result = executeRoll(
      req({ expression: "2d6+3" }),
      facesRng([
        [4, 6],
        [2, 6],
      ]),
    );
    expect(result.groups).toEqual([{ sides: 6, rolls: [4, 2], kept: [4, 2] }]);
    expect(result.modifier).toBe(3);
    expect(result.total).toBe(9);
  });

  it("handles negative modifiers", () => {
    const result = executeRoll(
      req({ expression: "1d20-2" }),
      facesRng([[10, 20]]),
    );
    expect(result.total).toBe(8);
    expect(result.modifier).toBe(-2);
  });

  it("sums multiple dice groups and aggregates flat modifiers", () => {
    const result = executeRoll(
      req({ expression: "1d8+1d6+4-1", kind: "damage" }),
      facesRng([
        [5, 8],
        [3, 6],
      ]),
    );
    expect(result.groups).toHaveLength(2);
    expect(result.modifier).toBe(3);
    expect(result.total).toBe(11);
  });

  it("subtracts a negated dice group from the total", () => {
    const result = executeRoll(
      req({ expression: "1d20-1d4" }),
      facesRng([
        [15, 20],
        [3, 4],
      ]),
    );
    expect(result.total).toBe(12);
  });

  it("keeps every face within [1, sides] across many rolls", () => {
    const rng = seededRng(1234);
    for (let i = 0; i < 50; i++) {
      const result = executeRoll(req({ expression: "10d6" }), rng);
      for (const face of result.groups[0].rolls) {
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(6);
      }
      expect(result.groups[0].rolls).toHaveLength(10);
    }
  });

  it("is deterministic: same seed, same result", () => {
    const roll = () =>
      executeRoll(req({ expression: "8d6+2d4+5" }), seededRng(42));
    const a = roll();
    const b = roll();
    expect(a.groups).toEqual(b.groups);
    expect(a.total).toBe(b.total);
  });

  it("stamps rolled_at as an ISO timestamp", () => {
    const result = executeRoll(req({}), seededRng(1));
    expect(new Date(result.rolled_at).toISOString()).toBe(result.rolled_at);
  });

  it("echoes the request back on the result", () => {
    const request = req({ expression: "1d20+5", meta: { dc: 15 } });
    const result = executeRoll(request, seededRng(1));
    expect(result.request).toBe(request);
  });
});

describe("executeRoll — keep highest / keep lowest", () => {
  it("2d20kh1 keeps the higher die and records both rolls", () => {
    const result = executeRoll(
      req({ expression: "2d20kh1+7" }),
      facesRng([
        [8, 20],
        [14, 20],
      ]),
    );
    expect(result.groups[0]).toEqual({ sides: 20, rolls: [8, 14], kept: [14] });
    expect(result.total).toBe(21);
  });

  it("4d6kl3 keeps the three lowest dice", () => {
    const result = executeRoll(
      req({ expression: "4d6kl3" }),
      facesRng([
        [6, 6],
        [2, 6],
        [5, 6],
        [3, 6],
      ]),
    );
    expect(result.groups[0].rolls).toEqual([6, 2, 5, 3]);
    expect(result.groups[0].kept).toEqual([2, 5, 3]); // roll order preserved
    expect(result.total).toBe(10);
  });

  it("breaks ties by keeping the earliest roll", () => {
    const result = executeRoll(
      req({ expression: "3d6kh2" }),
      facesRng([
        [4, 6],
        [4, 6],
        [4, 6],
      ]),
    );
    expect(result.groups[0].kept).toEqual([4, 4]);
    expect(result.total).toBe(8);
  });
});

describe("executeRoll — advantage / disadvantage", () => {
  it("advantage on 1d20+5 rolls two d20s keeping the higher", () => {
    const result = executeRoll(
      req({ expression: "1d20+5", mode: "advantage" }),
      facesRng([
        [7, 20],
        [18, 20],
      ]),
    );
    expect(result.groups[0]).toEqual({ sides: 20, rolls: [7, 18], kept: [18] });
    expect(result.total).toBe(23);
    expect(result.natural).toBe(18);
  });

  it("disadvantage on 1d20+5 keeps the lower die", () => {
    const result = executeRoll(
      req({ expression: "1d20+5", mode: "disadvantage" }),
      facesRng([
        [7, 20],
        [18, 20],
      ]),
    );
    expect(result.groups[0]).toEqual({ sides: 20, rolls: [7, 18], kept: [7] });
    expect(result.total).toBe(12);
    expect(result.natural).toBe(7);
  });

  it("mode 'normal' leaves the expression untouched", () => {
    const result = executeRoll(
      req({ expression: "1d20+5", mode: "normal" }),
      facesRng([[11, 20]]),
    );
    expect(result.groups[0].rolls).toHaveLength(1);
    expect(result.total).toBe(16);
  });

  it("does not rewrite non-d20 expressions on advantage", () => {
    const result = executeRoll(
      req({ expression: "2d6+3", mode: "advantage" }),
      facesRng([
        [4, 6],
        [2, 6],
      ]),
    );
    expect(result.groups[0].rolls).toHaveLength(2);
    expect(result.groups[0].kept).toEqual([4, 2]);
  });
});

describe("executeRoll — crit doubling", () => {
  it("crit on 2d6+3 rolls 4d6 and adds the modifier once", () => {
    const result = executeRoll(
      req({ expression: "2d6+3", kind: "damage", crit: true }),
      facesRng([
        [4, 6],
        [2, 6],
        [6, 6],
        [1, 6],
      ]),
    );
    expect(result.groups[0].rolls).toEqual([4, 2, 6, 1]);
    expect(result.modifier).toBe(3);
    expect(result.total).toBe(16);
  });

  it("crit doubles every dice group, not just the first", () => {
    const result = executeRoll(
      req({ expression: "1d8+1d6+2", kind: "damage", crit: true }),
      facesRng([
        [3, 8],
        [7, 8],
        [2, 6],
        [5, 6],
      ]),
    );
    expect(result.groups[0].rolls).toHaveLength(2);
    expect(result.groups[1].rolls).toHaveLength(2);
    expect(result.total).toBe(19);
  });

  it("crit: false leaves dice counts unchanged", () => {
    const result = executeRoll(
      req({ expression: "2d6+3", kind: "damage", crit: false }),
      facesRng([
        [4, 6],
        [2, 6],
      ]),
    );
    expect(result.groups[0].rolls).toHaveLength(2);
  });
});

describe("executeRoll — natural (crit/fumble detection)", () => {
  it("reports the kept d20 face on a plain 1d20 roll", () => {
    const result = executeRoll(
      req({ expression: "1d20+5" }),
      facesRng([[20, 20]]),
    );
    expect(result.natural).toBe(20);
  });

  it("reports a natural 1", () => {
    const result = executeRoll(req({ expression: "1d20" }), facesRng([[1, 20]]));
    expect(result.natural).toBe(1);
  });

  it("is absent for non-d20 rolls", () => {
    const result = executeRoll(
      req({ expression: "8d6", kind: "damage" }),
      seededRng(7),
    );
    expect(result.natural).toBeUndefined();
  });

  it("is absent when multiple d20s are kept (no single natural)", () => {
    const result = executeRoll(
      req({ expression: "2d20" }),
      facesRng([
        [4, 20],
        [17, 20],
      ]),
    );
    expect(result.natural).toBeUndefined();
  });
});

describe("executeRoll — input validation", () => {
  it("propagates DiceParseError for malformed expressions", () => {
    expect(() => executeRoll(req({ expression: "2x6" }), seededRng(1))).toThrow(
      /Expected '\+' or '-'/,
    );
  });
});
