import type { CharacterState } from "@/lib/types/character";
import type { GrantEffect, Effect } from "@/lib/types/effects";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { mechanicalEffectSchema } from "@/lib/schemas/effects";
import { RACE_ABILITY_SLUGS } from "@/lib/engine/race-ability-scores";

/** Returns a CharacterState with all fields defaulted. Merges with existing partial state.
 *
 *  The spread carries EVERY persisted field through hydration — fields the
 *  defaults below don't mention (`exhaustion`, `feature_uses`,
 *  `active_effects`, `concentrating_on`, `hit_dice_spent`, `currency`,
 *  toggles, …) must survive a page load, or the next patch computed from the
 *  hydrated state silently overwrites the DB's values. */
export function initializeState(
  partial: CharacterState,
  maxHp: number,
): CharacterState {
  return {
    ...partial,
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

export type SavingThrowBonus = { status: "available"; bonus: number }
  | { status: "unavailable"; reason: string };
export type SavingThrowModifier = { status: "available"; modifier: number; proficient: boolean }
  | { status: "unavailable"; reason: string };
const saveUnavailable = (detail: string): Extract<SavingThrowBonus, { status: "unavailable" }> => ({
  status: "unavailable", reason: `Saving throws are unavailable. ${detail}`,
});

/** Consume the existing evaluation, never sum, reroute or rerun effects here.
 * Effects must be the ordered inputs used for that result. Validation retains raw entries. */
export function resolveSavingThrowBonus(
  result: EvaluationResult,
  schema: SystemSchemaDefinition,
  effects: readonly Effect[] | undefined,
): SavingThrowBonus {
  if (!Array.isArray(effects) || !Array.isArray(schema.derived_stats) || !result.stats || !result.computed) {
    return saveUnavailable("The saved bonus inputs are incomplete. Reload before rolling.");
  }
  for (const effect of effects) {
    if (!effect || typeof effect !== "object") return saveUnavailable("The saved effect inputs are incomplete. Reload before rolling.");
    if (effect.type !== "mechanical" || effect.stat !== "saving_throw_bonus") continue;
    if (!mechanicalEffectSchema.safeParse(effect).success
      || (effect.op === "formula" ? !effect.expr?.trim() || effect.tag === "ac_formula"
        : !["add", "set", "multiply", "max", "min"].includes(effect.op)
          || typeof effect.value !== "number" || !Number.isFinite(effect.value))) {
      return saveUnavailable("A saved bonus effect has unsupported numeric input or routing. Review it before rolling.");
    }
  }
  const declarations = schema.derived_stats.filter(entry => entry.slug === "saving_throw_bonus");
  if (declarations.length > 1) return saveUnavailable("The saved bonus definition is ambiguous. Reload or review the game system.");
  let bonus: number;
  if (declarations.length === 1) {
    if (!Object.hasOwn(result.computed, "saving_throw_bonus")) {
      return saveUnavailable("The declared bonus result is missing. Reload or review the game system.");
    }
    bonus = result.computed.saving_throw_bonus;
  } else {
    if (Object.hasOwn(result.computed, "saving_throw_bonus")) {
      return saveUnavailable("The bonus result has no saved definition. Reload or review the game system.");
    }
    bonus = Object.hasOwn(result.stats, "saving_throw_bonus") ? result.stats.saving_throw_bonus : 0;
  }
  return Number.isSafeInteger(bonus) ? { status: "available", bonus }
    : saveUnavailable("The evaluated bonus must be a safe integer. Review the saved effects without rounding them.");
}

/** Shared final admission for ability saves, CON concentration and paper values.
 * The grant-only helper above retains its existing pure-model compatibility. */
export function resolveSavingThrowModifier(
  abilityMod: number | null,
  proficiencyBonus: number,
  grants: GrantEffect[],
  saveSlug: string,
  bonus: SavingThrowBonus | undefined,
): SavingThrowModifier {
  if (!bonus || bonus.status !== "available") {
    return bonus?.status === "unavailable" ? bonus : saveUnavailable("The saved bonus inputs are incomplete. Reload before rolling.");
  }
  if (!RACE_ABILITY_SLUGS.some(ability => saveSlug === `saving_throw_${ability}`)
    || abilityMod === null || !Number.isFinite(abilityMod) || !Number.isFinite(proficiencyBonus)
    || !Number.isSafeInteger(bonus.bonus) || !Array.isArray(grants)) {
    return saveUnavailable("The required saved ability, proficiency or bonus value is invalid. Reload before rolling.");
  }
  const modifier = getSaveModifier(abilityMod, proficiencyBonus, grants, saveSlug) + bonus.bonus;
  return Number.isSafeInteger(modifier) ? { status: "available", modifier, proficient: isProficient(grants, saveSlug) }
    : saveUnavailable("The final modifier must be a safe integer. Review the saved values without rounding them.");
}
