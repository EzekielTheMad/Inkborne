import { describe, it, expect } from "vitest";
import { rarityTextClass } from "@/lib/inventory/rarity-colors";

describe("rarityTextClass", () => {
  it("returns default for Common", () => {
    expect(rarityTextClass("Common")).toBe("text-foreground");
  });

  it("returns green for Uncommon", () => {
    expect(rarityTextClass("Uncommon")).toBe("text-green-400");
  });

  it("returns blue for Rare", () => {
    expect(rarityTextClass("Rare")).toBe("text-blue-400");
  });

  it("returns purple for Very Rare", () => {
    expect(rarityTextClass("Very Rare")).toBe("text-purple-400");
  });

  it("returns orange for Legendary", () => {
    expect(rarityTextClass("Legendary")).toBe("text-orange-400");
  });

  it("returns red for Artifact", () => {
    expect(rarityTextClass("Artifact")).toBe("text-red-400");
  });

  it("returns default for null", () => {
    expect(rarityTextClass(null)).toBe("text-foreground");
  });

  it("returns default for undefined", () => {
    expect(rarityTextClass(undefined)).toBe("text-foreground");
  });

  it("returns default for unknown rarity", () => {
    expect(rarityTextClass("Mythical")).toBe("text-foreground");
  });
});
