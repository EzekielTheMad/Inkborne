import { describe, it, expect } from "vitest";
import { computeMaxHp } from "@/lib/character/max-hp";

describe("computeMaxHp", () => {
  // Helpers for fixture setup
  const classData = (slug: string, hitDie: number) => ({
    [slug]: { slug, data: { hit_die: hitDie } },
  });

  it("returns 0 when no classes", () => {
    expect(computeMaxHp([], {}, 10)).toBe(0);
  });

  it("Fighter L1, CON 14 → 12 (10 + 2)", () => {
    const result = computeMaxHp(
      [{ slug: "fighter", level: 1 }],
      classData("fighter", 10),
      14,
    );
    expect(result).toBe(12);
  });

  it("Fighter L5, CON 14 → 44 (12 + 4*8)", () => {
    // L1: max(1, 10 + 2) = 12
    // L2-5: max(1, avg(d10) + 2) = max(1, 6 + 2) = 8 each × 4 = 32
    const result = computeMaxHp(
      [{ slug: "fighter", level: 5 }],
      classData("fighter", 10),
      14,
    );
    expect(result).toBe(44);
  });

  it("Wizard L5, CON 12 → 27 (7 + 4*5)", () => {
    // L1: max(1, 6 + 1) = 7
    // L2-5: max(1, avg(d6) + 1) = max(1, 4 + 1) = 5 each × 4 = 20
    const result = computeMaxHp(
      [{ slug: "wizard", level: 5 }],
      classData("wizard", 6),
      12,
    );
    expect(result).toBe(27);
  });

  it("Barbarian L3, CON 16 → 35 (15 + 2*10)", () => {
    // L1: max(1, 12 + 3) = 15
    // L2-3: max(1, avg(d12) + 3) = max(1, 7 + 3) = 10 each × 2 = 20
    const result = computeMaxHp(
      [{ slug: "barbarian", level: 3 }],
      classData("barbarian", 12),
      16,
    );
    expect(result).toBe(35);
  });

  it("multiclass Fighter 3 / Wizard 2, CON 14 → 42", () => {
    // Fighter is primary (first in list) → L1 = max die.
    // Fighter L1: max(1, 10 + 2) = 12
    // Fighter L2-3: max(1, 6 + 2) = 8 × 2 = 16
    // Wizard L1 (multiclass, not primary): max(1, 4 + 2) = 6
    // Wizard L2: max(1, 4 + 2) = 6
    // Total: 12 + 16 + 6 + 6 = 40
    const result = computeMaxHp(
      [{ slug: "fighter", level: 3 }, { slug: "wizard", level: 2 }],
      { ...classData("fighter", 10), ...classData("wizard", 6) },
      14,
    );
    expect(result).toBe(40);
  });

  it("primary class is the FIRST entry in classes[]", () => {
    // If Wizard is primary: Wizard L1 = 6+0=6, +4 avg (5) = 26. Fighter L3 avg = (6)*3 = 18. Total = 44.
    const result = computeMaxHp(
      [{ slug: "wizard", level: 5 }, { slug: "fighter", level: 3 }],
      { ...classData("fighter", 10), ...classData("wizard", 6) },
      10, // CON 10 = mod 0 for cleaner arithmetic
    );
    // Wizard primary L1 = max(1, 6+0) = 6
    // Wizard L2-5 = max(1, 4+0) = 4 × 4 = 16
    // Fighter L1-3 (not primary → avg) = max(1, 6+0) = 6 × 3 = 18
    expect(result).toBe(40);
  });

  it("floors at 1 HP per level when CON mod is very negative", () => {
    // CON 3 = mod -4. Fighter L3: L1 = max(1, 10-4) = 6, L2-3 = max(1, 6-4) = 2 × 2 = 4. Total = 10.
    const result = computeMaxHp(
      [{ slug: "fighter", level: 3 }],
      classData("fighter", 10),
      3,
    );
    expect(result).toBe(10);
  });

  it("falls back to d8 when class data missing hit_die", () => {
    // Safer default than throwing; class data might be incomplete in edge cases.
    const result = computeMaxHp(
      [{ slug: "unknown", level: 1 }],
      { unknown: { slug: "unknown", data: {} } },
      14,
    );
    // d8 max = 8; 8 + 2 = 10
    expect(result).toBe(10);
  });

  it("falls back to d8 when class data is entirely missing", () => {
    const result = computeMaxHp(
      [{ slug: "missing", level: 1 }],
      {},
      10,
    );
    expect(result).toBe(8); // d8 max + CON 0
  });

  it("handles Cleric L1 + Paladin L1 multiclass correctly", () => {
    // Cleric primary L1 = max(1, 8+2) = 10
    // Paladin L1 (multiclass) = max(1, avg(d10) + 2) = max(1, 6+2) = 8
    const result = computeMaxHp(
      [{ slug: "cleric", level: 1 }, { slug: "paladin", level: 1 }],
      { ...classData("cleric", 8), ...classData("paladin", 10) },
      14,
    );
    expect(result).toBe(18);
  });
});
