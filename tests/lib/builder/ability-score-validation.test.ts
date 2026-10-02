import { describe, expect, it } from "vitest";
import { hasCompleteAbilityScores } from "@/lib/builder/ability-score-validation";

const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug }));
const scores = { strength: 15, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };

describe("saved ability readiness", () => {
  it("accepts every required array score without counting unrelated base-stat keys", () => {
    expect(hasCompleteAbilityScores("standard_array", { ...scores, level: 1 }, abilities)).toBe(true);
  });
  it("rejects a sparse map even when a method and unrelated fields are saved", () => {
    expect(hasCompleteAbilityScores("manual", { strength: 10, level: 1 }, abilities)).toBe(false);
  });
  it.each([NaN, Infinity, 0, 31, 10.5])("rejects an invalid required base score %s", value => {
    expect(hasCompleteAbilityScores("manual", { ...scores, strength: value }, abilities)).toBe(false);
  });
  it("does not validate unknown abilities or a disallowed method as complete", () => {
    expect(hasCompleteAbilityScores("manual", scores, undefined)).toBe(false);
    expect(hasCompleteAbilityScores("manual", scores, abilities, ["point_buy"])).toBe(false);
    expect(hasCompleteAbilityScores("future-method", scores, abilities)).toBe(false);
  });
  it("rejects duplicated or non-array assignments", () => {
    expect(hasCompleteAbilityScores("standard_array", { ...scores, dexterity: 15 }, abilities)).toBe(false);
    expect(hasCompleteAbilityScores("standard_array", { ...scores, strength: 16 }, abilities)).toBe(false);
  });
  it("uses the editor's point-buy cost and bounds without requiring every point spent", () => {
    expect(hasCompleteAbilityScores("point_buy", scores, abilities)).toBe(true);
    expect(hasCompleteAbilityScores("point_buy", Object.fromEntries(abilities.map(({ slug }) => [slug, 15])), abilities)).toBe(false);
    expect(hasCompleteAbilityScores("point_buy", { ...scores, strength: 16 }, abilities)).toBe(false);
    expect(hasCompleteAbilityScores("point_buy", Object.fromEntries(abilities.map(({ slug }) => [slug, 8])), abilities)).toBe(true);
  });
  it("reads the system's actual ability slugs rather than assuming six D&D fields", () => {
    expect(hasCompleteAbilityScores("manual", { might: 10, spirit: 12 }, [{ slug: "might" }, { slug: "spirit" }])).toBe(true);
    expect(hasCompleteAbilityScores("manual", scores, [{ slug: "might" }])).toBe(false);
  });
});
