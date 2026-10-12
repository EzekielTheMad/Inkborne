import { RACE_ABILITY_SLUGS } from "@/lib/engine/race-ability-scores";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";

export type AbilityMechanics = { status: "available"; capUnverified: boolean } | { status: "unavailable"; reason: string };
const unavailable = (reason: string): AbilityMechanics => ({ status: "unavailable", reason });
export function hasShippedAbilityDefinitions(schema: SystemSchemaDefinition): boolean {
  if (!Array.isArray(schema.ability_scores) || !Array.isArray(schema.derived_stats)) return false;
  return schema.ability_scores.length === RACE_ABILITY_SLUGS.length && RACE_ABILITY_SLUGS.every(slug => schema.ability_scores.filter(entry => entry.slug === slug).length === 1);
}
export function resolveAbilityMechanics(base: Record<string, number>, result: EvaluationResult, schema: SystemSchemaDefinition, permanent = result): AbilityMechanics {
  if (result.asi?.status !== "available") return unavailable("Saved ASI evidence is unavailable. Reload or restore its exact class feature pins.");
  if (!hasShippedAbilityDefinitions(schema)) return unavailable("Saved mechanics are unavailable. The six saved ability definitions are missing or ambiguous.");
  if (!RACE_ABILITY_SLUGS.every(slug => Object.hasOwn(base, slug) && Number.isFinite(base[slug]) && Object.hasOwn(result.stats, slug) && Number.isFinite(result.stats[slug]))) return unavailable("Saved mechanics are unavailable. Complete finite saved ability scores are required. Draft defaults are not confirmed mechanics.");
  return { status: "available", capUnverified: result.asi.allocations.some(entry => permanent.stats[entry.ability] > 20) };
}
/** Declared formulas are authoritative: a missing/nonfinite computed result cannot fallback. */
export function getConfirmedAbilityModifier(result: EvaluationResult, schema: SystemSchemaDefinition, ability: string): number | null {
  if (!hasShippedAbilityDefinitions(schema) || !RACE_ABILITY_SLUGS.some(slug => slug === ability) || !Object.hasOwn(result.stats, ability) || !Number.isFinite(result.stats[ability])) return null;
  const name = `${ability}_mod`, declarations = schema.derived_stats.filter(entry => entry.slug === name);
  if (declarations.length > 1) return null;
  if (declarations[0]?.formula !== undefined) return Object.hasOwn(result.computed, name) && Number.isFinite(result.computed[name]) ? result.computed[name] : null;
  const value = declarations.length ? result.computed[name] : Math.floor((result.stats[ability] - 10) / 2);
  return Number.isFinite(value) ? value : null;
}
export interface MechanicsRequirement { abilities?: readonly string[]; computed?: readonly string[]; values?: readonly number[] }
export function assertAbilityMechanics(readiness: AbilityMechanics, result: EvaluationResult, schema: SystemSchemaDefinition, requirement: MechanicsRequirement = {}): void {
  if (readiness.status !== "available") throw new Error(readiness.reason);
  if ((requirement.abilities ?? []).some(slug => getConfirmedAbilityModifier(result, schema, slug) === null)
    || (requirement.computed ?? []).some(slug => !Object.hasOwn(result.computed, slug) || !Number.isFinite(result.computed[slug]))
    || (requirement.values ?? []).some(value => !Number.isFinite(value))) throw new Error("Required saved mechanical values are unavailable. Reload before using this action.");
}
