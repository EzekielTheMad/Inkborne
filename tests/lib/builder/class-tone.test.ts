import { describe, it, expect } from "vitest";
import { classTone, classEmblemLetter } from "@/lib/builder/class-tone";

describe("classTone", () => {
  it("returns purple for canonical caster classes", () => {
    expect(classTone("wizard")).toBe("purple");
    expect(classTone("sorcerer")).toBe("purple");
    expect(classTone("warlock")).toBe("purple");
    expect(classTone("bard")).toBe("purple");
    expect(classTone("cleric")).toBe("purple");
    expect(classTone("druid")).toBe("purple");
  });

  it("returns gold for non-caster (martial) classes", () => {
    expect(classTone("paladin")).toBe("gold");
    expect(classTone("fighter")).toBe("gold");
    expect(classTone("barbarian")).toBe("gold");
    expect(classTone("monk")).toBe("gold");
    expect(classTone("ranger")).toBe("gold");
    expect(classTone("rogue")).toBe("gold");
  });

  it("falls back to gold for unknown slugs", () => {
    expect(classTone("artificer")).toBe("gold");
    expect(classTone("homebrew-class")).toBe("gold");
  });
});

describe("classEmblemLetter", () => {
  it("returns the uppercased first letter of the class name", () => {
    expect(classEmblemLetter("paladin", "Paladin")).toBe("P");
    expect(classEmblemLetter("wizard", "Wizard")).toBe("W");
  });

  it("falls back to the first letter of the slug when no name given", () => {
    expect(classEmblemLetter("rogue")).toBe("R");
  });
});
