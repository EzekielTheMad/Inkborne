import { describe, it, expect } from "vitest";
import { parseExpression } from "@/lib/engine/parser";

describe("parseExpression", () => {
  const stats: Record<string, number> = {
    strength: 16,
    dexterity: 14,
    constitution: 12,
    wisdom: 10,
    level: 5,
    proficiency_bonus: 3,
  };

  const builtins: Record<string, (...args: unknown[]) => number> = {
    mod: (...args: unknown[]) => Math.floor((args[0] as number - 10) / 2),
    proficiency_if: (...args: unknown[]) =>
      (args[0] as string) === "perception" ? stats.proficiency_bonus : 0,
  };

  it("evaluates simple arithmetic", () => {
    expect(parseExpression("10 + 2", stats, builtins)).toBe(12);
  });

  it("evaluates stat references", () => {
    expect(parseExpression("strength", stats, builtins)).toBe(16);
  });

  it("evaluates mod() function", () => {
    expect(parseExpression("mod(strength)", stats, builtins)).toBe(3);
  });

  it("evaluates complex formula: AC", () => {
    expect(parseExpression("10 + mod(dexterity)", stats, builtins)).toBe(12);
  });

  it("evaluates proficiency bonus formula", () => {
    expect(parseExpression("floor((level - 1) / 4) + 2", stats, builtins)).toBe(3);
  });

  it("evaluates nested functions", () => {
    expect(
      parseExpression("10 + mod(wisdom) + proficiency_if('perception')", stats, builtins)
    ).toBe(13);
  });

  it("evaluates multiplication and parentheses", () => {
    expect(parseExpression("mod(constitution) * level", stats, builtins)).toBe(5);
  });

  it("throws on invalid expression", () => {
    expect(() => parseExpression("DROP TABLE users", stats, builtins)).toThrow();
  });

  it("returns 0 for unknown stat reference", () => {
    expect(parseExpression("charisma + 1", stats, builtins)).toBe(1);
  });

  it("evaluates floor() built-in", () => {
    expect(parseExpression("floor(7 / 2)", stats, builtins)).toBe(3);
  });
});
