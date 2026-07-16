import { describe, it, expect } from "vitest";
import { parseSpellDuration } from "@/lib/spells/duration";

describe("parseSpellDuration", () => {
  it("parses Instantaneous", () => {
    expect(parseSpellDuration("Instantaneous")).toEqual({
      type: "instantaneous",
    });
  });

  it("parses rounds", () => {
    expect(parseSpellDuration("1 round")).toEqual({ type: "rounds", value: 1 });
    expect(parseSpellDuration("3 rounds")).toEqual({ type: "rounds", value: 3 });
  });

  it("parses minutes", () => {
    expect(parseSpellDuration("1 minute")).toEqual({
      type: "minutes",
      value: 1,
    });
    expect(parseSpellDuration("10 minutes")).toEqual({
      type: "minutes",
      value: 10,
    });
  });

  it("parses hours and days", () => {
    expect(parseSpellDuration("8 hours")).toEqual({ type: "hours", value: 8 });
    expect(parseSpellDuration("1 hour")).toEqual({ type: "hours", value: 1 });
    expect(parseSpellDuration("7 days")).toEqual({
      type: "hours",
      value: 168,
    });
  });

  it("strips PHB-style concentration prefix", () => {
    expect(parseSpellDuration("Concentration, up to 10 minutes")).toEqual({
      type: "minutes",
      value: 10,
    });
    expect(parseSpellDuration("Concentration, up to 1 hour")).toEqual({
      type: "hours",
      value: 1,
    });
  });

  it("strips dnd5eapi-style 'Up to' prefix", () => {
    expect(parseSpellDuration("Up to 1 minute")).toEqual({
      type: "minutes",
      value: 1,
    });
  });

  it("maps Until dispelled to special", () => {
    expect(parseSpellDuration("Until dispelled")).toEqual({ type: "special" });
    expect(parseSpellDuration("Until dispelled or triggered")).toEqual({
      type: "special",
    });
  });

  it("maps rest-bounded durations to until_rest", () => {
    expect(
      parseSpellDuration("Until you finish a short or long rest"),
    ).toEqual({ type: "until_rest" });
  });

  it("maps unknown strings to special (never throws)", () => {
    expect(parseSpellDuration("Special")).toEqual({ type: "special" });
    expect(parseSpellDuration("gibberish 42 parsecs")).toEqual({
      type: "special",
    });
    expect(parseSpellDuration("")).toEqual({ type: "special" });
  });

  it("is case-insensitive", () => {
    expect(parseSpellDuration("INSTANTANEOUS")).toEqual({
      type: "instantaneous",
    });
    expect(parseSpellDuration("concentration, UP TO 1 Minute")).toEqual({
      type: "minutes",
      value: 1,
    });
  });
});
