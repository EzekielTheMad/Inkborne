import { describe, it, expect } from "vitest";
import {
  buildMechanicalEffect,
  buildGrantEffect,
  buildNarrativeEffect,
  buildChoiceEffect,
  buildAbilityBonusEffects,
  normalizeSlug,
} from "@/scripts/transformers/common";

describe("normalizeSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(normalizeSlug("Sleight of Hand")).toBe("sleight-of-hand");
  });

  it("handles already normalized slugs", () => {
    expect(normalizeSlug("athletics")).toBe("athletics");
  });
});

describe("buildMechanicalEffect", () => {
  it("builds an add effect", () => {
    const effect = buildMechanicalEffect("dexterity", "add", 2);
    expect(effect).toEqual({
      type: "mechanical",
      stat: "dexterity",
      op: "add",
      value: 2,
    });
  });
});

describe("buildGrantEffect", () => {
  it("builds a grant effect", () => {
    const effect = buildGrantEffect("perception", "proficient");
    expect(effect).toEqual({
      type: "grant",
      stat: "perception",
      value: "proficient",
    });
  });
});

describe("buildNarrativeEffect", () => {
  it("builds a narrative effect with tag", () => {
    const effect = buildNarrativeEffect("You have darkvision 60ft", "Racial Trait");
    expect(effect).toEqual({
      type: "narrative",
      text: "You have darkvision 60ft",
      tag: "Racial Trait",
    });
  });
});

describe("buildChoiceEffect", () => {
  it("builds a choice effect", () => {
    const effect = buildChoiceEffect(2, ["athletics", "acrobatics"], "skill_proficiency", "fighter-skills");
    expect(effect).toEqual({
      type: "choice",
      choose: 2,
      from: ["athletics", "acrobatics"],
      grant_type: "skill_proficiency",
      choice_id: "fighter-skills",
    });
  });
});

describe("buildAbilityBonusEffects", () => {
  it("converts API ability bonuses to effects", () => {
    const apiBonuses = [
      { ability_score: { index: "dex", name: "DEX" }, bonus: 2 },
      { ability_score: { index: "wis", name: "WIS" }, bonus: 1 },
    ];
    const effects = buildAbilityBonusEffects(apiBonuses);
    expect(effects).toHaveLength(2);
    expect(effects[0]).toEqual({
      type: "mechanical",
      stat: "dexterity",
      op: "add",
      value: 2,
    });
    expect(effects[1]).toEqual({
      type: "mechanical",
      stat: "wisdom",
      op: "add",
      value: 1,
    });
  });
});
