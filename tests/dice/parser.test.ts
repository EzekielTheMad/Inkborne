import { describe, it, expect } from "vitest";
import { parseDiceExpression } from "@/lib/dice/parser";
import { DiceParseError } from "@/lib/dice/types";

describe("parseDiceExpression — valid expressions", () => {
  it("parses a d20 with a modifier: 1d20+5", () => {
    expect(parseDiceExpression("1d20+5")).toEqual({
      terms: [
        { type: "dice", sign: 1, count: 1, sides: 20, keep: undefined },
        { type: "modifier", sign: 1, value: 5 },
      ],
    });
  });

  it("parses multiple dice with a modifier: 2d6+3", () => {
    expect(parseDiceExpression("2d6+3")).toEqual({
      terms: [
        { type: "dice", sign: 1, count: 2, sides: 6, keep: undefined },
        { type: "modifier", sign: 1, value: 3 },
      ],
    });
  });

  it("parses a bare dice term: 8d6", () => {
    expect(parseDiceExpression("8d6")).toEqual({
      terms: [{ type: "dice", sign: 1, count: 8, sides: 6, keep: undefined }],
    });
  });

  it("parses keep-highest with modifier: 2d20kh1+7", () => {
    expect(parseDiceExpression("2d20kh1+7")).toEqual({
      terms: [
        {
          type: "dice",
          sign: 1,
          count: 2,
          sides: 20,
          keep: { mode: "highest", count: 1 },
        },
        { type: "modifier", sign: 1, value: 7 },
      ],
    });
  });

  it("parses keep-lowest: 4d6kl3", () => {
    expect(parseDiceExpression("4d6kl3")).toEqual({
      terms: [
        {
          type: "dice",
          sign: 1,
          count: 4,
          sides: 6,
          keep: { mode: "lowest", count: 3 },
        },
      ],
    });
  });

  it("parses bare d20 with implicit count 1", () => {
    expect(parseDiceExpression("d20")).toEqual({
      terms: [{ type: "dice", sign: 1, count: 1, sides: 20, keep: undefined }],
    });
  });

  it("tolerates whitespace and uppercase: ' 1D20 + 5 '", () => {
    expect(parseDiceExpression(" 1D20 + 5 ")).toEqual(
      parseDiceExpression("1d20+5"),
    );
  });

  it("parses subtraction as a signed term: 1d20-2", () => {
    expect(parseDiceExpression("1d20-2")).toEqual({
      terms: [
        { type: "dice", sign: 1, count: 1, sides: 20, keep: undefined },
        { type: "modifier", sign: -1, value: 2 },
      ],
    });
  });

  it("parses chains of mixed terms: 1d8+1d6+4-1", () => {
    expect(parseDiceExpression("1d8+1d6+4-1")).toEqual({
      terms: [
        { type: "dice", sign: 1, count: 1, sides: 8, keep: undefined },
        { type: "dice", sign: 1, count: 1, sides: 6, keep: undefined },
        { type: "modifier", sign: 1, value: 4 },
        { type: "modifier", sign: -1, value: 1 },
      ],
    });
  });

  it("parses a subtracted dice term: 1d20-1d4", () => {
    expect(parseDiceExpression("1d20-1d4")).toEqual({
      terms: [
        { type: "dice", sign: 1, count: 1, sides: 20, keep: undefined },
        { type: "dice", sign: -1, count: 1, sides: 4, keep: undefined },
      ],
    });
  });

  it("parses a flat integer: 5", () => {
    expect(parseDiceExpression("5")).toEqual({
      terms: [{ type: "modifier", sign: 1, value: 5 }],
    });
  });
});

describe("parseDiceExpression — malformed expressions", () => {
  const reject = (expr: string, pattern: RegExp) => {
    expect(() => parseDiceExpression(expr)).toThrowError(DiceParseError);
    expect(() => parseDiceExpression(expr)).toThrowError(pattern);
  };

  it("rejects '2x6' (not dice notation)", () => {
    reject("2x6", /Expected '\+' or '-'/);
  });

  it("rejects '1d' (missing die size)", () => {
    reject("1d", /Missing die size/);
  });

  it("rejects '1d20kh' (missing keep count)", () => {
    reject("1d20kh", /Missing keep count/);
  });

  it("rejects '0d6' (zero dice count)", () => {
    reject("0d6", /Dice count must be at least 1/);
  });

  it("rejects '-1d20' (leading negative dice count)", () => {
    reject("-1d20", /Expected a dice term or number/);
  });

  it("rejects '1d20+' (trailing operator)", () => {
    reject("1d20+", /ends with an operator/);
  });

  it("rejects '1d20+-5' (double operator)", () => {
    reject("1d20+-5", /Expected a dice term or number/);
  });

  it("rejects '2d6kh3' (keep count exceeds dice count)", () => {
    reject("2d6kh3", /cannot exceed dice count/);
  });

  it("rejects '1d20kh0' (zero keep count)", () => {
    reject("1d20kh0", /Keep count must be at least 1/);
  });

  it("rejects '1d0' (zero-sided die)", () => {
    reject("1d0", /at least 1 side/);
  });

  it("rejects empty and whitespace-only strings", () => {
    reject("", /Empty dice expression/);
    reject("   ", /Empty dice expression/);
  });

  it("rejects absurd dice counts and sizes (sanity caps)", () => {
    reject("9999d6", /exceeds the maximum/);
    reject("1d99999", /exceeds the maximum/);
  });

  it("includes the offending expression in the error", () => {
    try {
      parseDiceExpression("2x6");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DiceParseError);
      expect((err as DiceParseError).expression).toBe("2x6");
      expect((err as DiceParseError).message).toContain("2x6");
    }
  });
});
