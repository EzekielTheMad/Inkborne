import { describe, it, expect } from "vitest";
import {
  initializeState,
  formatModifier,
  isProficient,
  hasExpertise,
  getSkillModifier,
  getSaveModifier,
} from "@/lib/sheet/helpers";
import type { GrantEffect } from "@/lib/types/effects";
import type { CharacterState } from "@/lib/types/character";

describe("initializeState", () => {
  it("fills all defaults when given an empty partial state", () => {
    const result = initializeState({}, 30);
    expect(result.current_hp).toBe(30);
    expect(result.temp_hp).toBe(0);
    expect(result.conditions).toEqual([]);
    expect(result.death_saves).toEqual({ successes: 0, failures: 0 });
    expect(result.inspiration).toBe(false);
    expect(result.quick_notes).toBe("");
    expect(result.notes).toBe("");
    expect(result.spell_slots_used).toEqual({});
  });

  it("preserves existing values from partial state", () => {
    const partial: CharacterState = {
      current_hp: 10,
      conditions: ["poisoned"],
      inspiration: true,
      quick_notes: "remember healing potion",
    };
    const result = initializeState(partial, 30);
    expect(result.current_hp).toBe(10);
    expect(result.conditions).toEqual(["poisoned"]);
    expect(result.inspiration).toBe(true);
    expect(result.quick_notes).toBe("remember healing potion");
    // Unfilled fields should get defaults
    expect(result.temp_hp).toBe(0);
    expect(result.death_saves).toEqual({ successes: 0, failures: 0 });
  });

  it("preserves current_hp of 0 instead of falling back to maxHp", () => {
    const result = initializeState({ current_hp: 0 }, 20);
    expect(result.current_hp).toBe(0);
  });

  it("preserves death save progress", () => {
    const result = initializeState(
      { death_saves: { successes: 2, failures: 1 } },
      20,
    );
    expect(result.death_saves).toEqual({ successes: 2, failures: 1 });
  });
});

describe("formatModifier", () => {
  it("formats positive numbers with a leading plus", () => {
    expect(formatModifier(3)).toBe("+3");
    expect(formatModifier(0)).toBe("+0");
  });

  it("formats negative numbers without an extra minus", () => {
    expect(formatModifier(-1)).toBe("-1");
    expect(formatModifier(-5)).toBe("-5");
  });
});

describe("isProficient", () => {
  const grants: GrantEffect[] = [
    { type: "grant", stat: "athletics", value: "proficient" },
    { type: "grant", stat: "stealth", value: "expertise" },
  ];

  it("returns true for a proficient stat", () => {
    expect(isProficient(grants, "athletics")).toBe(true);
  });

  it("returns false for an expertise stat (not proficient)", () => {
    expect(isProficient(grants, "stealth")).toBe(false);
  });

  it("returns false for an unknown stat", () => {
    expect(isProficient(grants, "arcana")).toBe(false);
  });

  it("returns false for an empty grants array", () => {
    expect(isProficient([], "athletics")).toBe(false);
  });
});

describe("hasExpertise", () => {
  const grants: GrantEffect[] = [
    { type: "grant", stat: "athletics", value: "proficient" },
    { type: "grant", stat: "stealth", value: "expertise" },
  ];

  it("returns true for an expertise stat", () => {
    expect(hasExpertise(grants, "stealth")).toBe(true);
  });

  it("returns false for a proficient (non-expertise) stat", () => {
    expect(hasExpertise(grants, "athletics")).toBe(false);
  });

  it("returns false for an unknown stat", () => {
    expect(hasExpertise(grants, "arcana")).toBe(false);
  });
});

describe("getSkillModifier", () => {
  const proficientGrants: GrantEffect[] = [
    { type: "grant", stat: "athletics", value: "proficient" },
  ];
  const expertiseGrants: GrantEffect[] = [
    { type: "grant", stat: "athletics", value: "expertise" },
  ];

  it("returns just the ability mod when not proficient", () => {
    expect(getSkillModifier(2, 3, [], "athletics")).toBe(2);
  });

  it("adds proficiency bonus when proficient", () => {
    expect(getSkillModifier(2, 3, proficientGrants, "athletics")).toBe(5);
  });

  it("adds double proficiency bonus when expert", () => {
    expect(getSkillModifier(2, 3, expertiseGrants, "athletics")).toBe(8);
  });
});

describe("getSaveModifier", () => {
  const saveGrants: GrantEffect[] = [
    { type: "grant", stat: "strength_save", value: "proficient" },
  ];

  it("returns just the ability mod when not proficient in save", () => {
    expect(getSaveModifier(1, 3, [], "strength_save")).toBe(1);
  });

  it("adds proficiency bonus when proficient in save", () => {
    expect(getSaveModifier(1, 3, saveGrants, "strength_save")).toBe(4);
  });
});
