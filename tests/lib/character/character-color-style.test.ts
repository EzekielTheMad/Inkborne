import { describe, it, expect } from "vitest";
import { characterColorStyle } from "@/lib/character/character-color-style";

describe("characterColorStyle", () => {
  it("returns an empty object when primaryColor is null", () => {
    expect(characterColorStyle(null)).toEqual({});
  });

  it("returns a CSS variable map for a lowercase hex", () => {
    expect(characterColorStyle("#7c3aed")).toEqual({
      "--character-color": "#7c3aed",
    });
  });

  it("returns a CSS variable map for an uppercase hex", () => {
    expect(characterColorStyle("#7C3AED")).toEqual({
      "--character-color": "#7C3AED",
    });
  });
});
