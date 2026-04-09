import type { CharacterState } from "@/lib/types/character";
import type { GrantEffect } from "@/lib/types/effects";

/** Returns a CharacterState with all fields defaulted. Merges with existing partial state. */
export function initializeState(
  partial: CharacterState,
  maxHp: number,
): CharacterState {
  return {
    current_hp: partial.current_hp ?? maxHp,
    temp_hp: partial.temp_hp ?? 0,
    conditions: partial.conditions ?? [],
    death_saves: partial.death_saves ?? { successes: 0, failures: 0 },
    inspiration: partial.inspiration ?? false,
    quick_notes: partial.quick_notes ?? "",
    notes: partial.notes ?? "",
    spell_slots_used: partial.spell_slots_used ?? {},
  };
}

/** Format a number as a modifier string: "+2", "-1", "+0" */
export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Check if a grants array includes proficiency for a given stat slug */
export function isProficient(grants: GrantEffect[], stat: string): boolean {
  return grants.some((g) => g.stat === stat && g.value === "proficient");
}

/** Check if a grants array includes expertise for a given stat slug */
export function hasExpertise(grants: GrantEffect[], stat: string): boolean {
  return grants.some((g) => g.stat === stat && g.value === "expertise");
}

/** Compute a skill modifier from ability mod + proficiency bonus (if proficient) */
export function getSkillModifier(
  abilityMod: number,
  proficiencyBonus: number,
  grants: GrantEffect[],
  skillSlug: string,
): number {
  if (hasExpertise(grants, skillSlug)) return abilityMod + proficiencyBonus * 2;
  if (isProficient(grants, skillSlug)) return abilityMod + proficiencyBonus;
  return abilityMod;
}

/** Compute a saving throw modifier from ability mod + proficiency bonus (if proficient) */
export function getSaveModifier(
  abilityMod: number,
  proficiencyBonus: number,
  grants: GrantEffect[],
  saveSlug: string,
): number {
  return isProficient(grants, saveSlug)
    ? abilityMod + proficiencyBonus
    : abilityMod;
}
