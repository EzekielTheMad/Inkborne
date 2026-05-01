import { describe, it, expect } from "vitest";
import {
  resolveHpRule,
  hpContributionForLevel,
  type HpRule,
} from "@/lib/builder/level-up-rules";
import type { HpRollRecord } from "@/lib/types/character";

describe("resolveHpRule", () => {
  it("returns campaign rule when present (campaign overrides system)", () => {
    expect(resolveHpRule("max_for_all", "free_choice")).toBe("max_for_all");
  });

  it("falls back to system rule when campaign is null", () => {
    expect(resolveHpRule(null, "average_only")).toBe("average_only");
  });

  it("falls back to system rule when campaign is undefined", () => {
    expect(resolveHpRule(undefined, "rolled_only")).toBe("rolled_only");
  });

  it("falls back to free_choice when both are null/undefined", () => {
    expect(resolveHpRule(null, null)).toBe("free_choice");
    expect(resolveHpRule(undefined, undefined)).toBe("free_choice");
  });
});

describe("hpContributionForLevel", () => {
  function input(overrides: Partial<Parameters<typeof hpContributionForLevel>[0]> = {}) {
    return {
      classSlug: "paladin",
      level: 2,
      die: 10,
      isFirstLevelOfPrimary: false,
      isFirstLevelOfClass: false,
      storedRoll: undefined as HpRollRecord | undefined,
      rule: "free_choice" as HpRule,
      ...overrides,
    };
  }

  it("returns max die for Lv1 of primary class regardless of rule or stored roll", () => {
    expect(
      hpContributionForLevel(
        input({ isFirstLevelOfPrimary: true, level: 1, rule: "average_only", storedRoll: { method: "rolled", value: 1 } }),
      ),
    ).toBe(10);
  });

  it("returns max die for every level when rule is max_for_all", () => {
    expect(hpContributionForLevel(input({ rule: "max_for_all", level: 7 }))).toBe(10);
    expect(hpContributionForLevel(input({ rule: "max_for_all", die: 6 }))).toBe(6);
  });

  it("returns max die for Lv1 of any class when rule is max_first_level_each_class", () => {
    expect(
      hpContributionForLevel(input({ rule: "max_first_level_each_class", isFirstLevelOfClass: true, level: 1 })),
    ).toBe(10);
  });

  it("falls through to free_choice for non-Lv1 levels under max_first_level_each_class", () => {
    expect(
      hpContributionForLevel(input({ rule: "max_first_level_each_class", level: 5 })),
    ).toBe(6); // averageHitDie(10) = 6
  });

  it("returns averageHitDie under average_only regardless of stored roll", () => {
    expect(
      hpContributionForLevel(input({ rule: "average_only", storedRoll: { method: "rolled", value: 9 } })),
    ).toBe(6);
    expect(hpContributionForLevel(input({ rule: "average_only", die: 8 }))).toBe(5);
  });

  it("uses stored roll under rolled_only when present", () => {
    expect(
      hpContributionForLevel(input({ rule: "rolled_only", storedRoll: { method: "rolled", value: 8 } })),
    ).toBe(8);
  });

  it("falls back to averageHitDie under rolled_only when no stored roll", () => {
    expect(hpContributionForLevel(input({ rule: "rolled_only", storedRoll: undefined }))).toBe(6);
  });

  it("uses stored roll value under free_choice", () => {
    expect(
      hpContributionForLevel(input({ rule: "free_choice", storedRoll: { method: "rolled", value: 7 } })),
    ).toBe(7);
  });

  it("falls back to averageHitDie under free_choice when no stored roll", () => {
    expect(hpContributionForLevel(input({ rule: "free_choice", storedRoll: undefined }))).toBe(6);
  });

  it("returns averageHitDie correctly for all standard hit dice", () => {
    expect(hpContributionForLevel(input({ die: 6 }))).toBe(4);  // d6 → 4
    expect(hpContributionForLevel(input({ die: 8 }))).toBe(5);  // d8 → 5
    expect(hpContributionForLevel(input({ die: 10 }))).toBe(6); // d10 → 6
    expect(hpContributionForLevel(input({ die: 12 }))).toBe(7); // d12 → 7
  });
});
