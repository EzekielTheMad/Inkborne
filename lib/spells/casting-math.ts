import type { AbilityScoreDefinition } from "@/lib/types/system";

export type CastingMathResolution =
  | { status: "available"; abilityModifier: number; spellAttackBonus: number; spellDc: number }
  | { status: "unavailable"; reason: string };

/** One finite evaluated profile for execution, preparation and presentation. */
export function resolveCastingMath(ability: string, abilities: readonly Pick<AbilityScoreDefinition, "slug">[], scores: Record<string, number>, proficiency: unknown): CastingMathResolution {
  const unavailable = (detail: string): CastingMathResolution => ({ status: "unavailable", reason: `Casting values are unavailable: ${detail}. Reload or restore the saved ability/class content.` });
  if (abilities.filter(entry => entry.slug === ability).length !== 1) return unavailable("the casting ability is not uniquely defined by this system");
  const score = scores[ability];
  if (typeof score !== "number" || !Number.isFinite(score) || typeof proficiency !== "number" || !Number.isFinite(proficiency)) return unavailable("evaluated ability or proficiency is missing or invalid");
  const abilityModifier = Math.floor((score - 10) / 2), spellAttackBonus = proficiency + abilityModifier, spellDc = 8 + spellAttackBonus;
  return [abilityModifier, spellAttackBonus, spellDc].every(Number.isFinite)
    ? { status: "available", abilityModifier, spellAttackBonus, spellDc }
    : unavailable("evaluated casting values overflow");
}
