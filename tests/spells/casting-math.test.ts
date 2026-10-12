import { describe, expect, it } from "vitest";
import { resolveCastingMath } from "@/lib/spells/casting-math";

describe("shared evaluated casting math", () => {
  it("accepts a unique evaluated ability without using its optional derived modifier", () => {
    expect(resolveCastingMath("intelligence", [{ slug: "intelligence" }], { intelligence: 14, intelligence_mod: 99 }, 2)).toEqual({ status: "available", abilityModifier: 2, spellAttackBonus: 4, spellDc: 12 });
  });
  it.each([
    { abilities: [], scores: { intelligence: 14 }, proficiency: 2 },
    { abilities: [{ slug: "intelligence" }, { slug: "intelligence" }], scores: { intelligence: 14 }, proficiency: 2 },
    { abilities: [{ slug: "intelligence" }], scores: {}, proficiency: 2 },
    { abilities: [{ slug: "intelligence" }], scores: { intelligence: NaN }, proficiency: 2 },
    { abilities: [{ slug: "intelligence" }], scores: { intelligence: Infinity }, proficiency: 2 },
    { abilities: [{ slug: "intelligence" }], scores: { intelligence: 14 }, proficiency: undefined },
    { abilities: [{ slug: "intelligence" }], scores: { intelligence: 14 }, proficiency: Infinity },
    { abilities: [{ slug: "intelligence" }], scores: { intelligence: Number.MAX_VALUE }, proficiency: Number.MAX_VALUE },
  ])("returns explicit unavailable with no numerical fallback for %j", input => {
    const result = resolveCastingMath("intelligence", input.abilities, input.scores as Record<string, number>, input.proficiency);
    expect(result.status).toBe("unavailable"); expect(result).not.toHaveProperty("spellDc"); expect(result).not.toHaveProperty("abilityModifier");
  });
});
