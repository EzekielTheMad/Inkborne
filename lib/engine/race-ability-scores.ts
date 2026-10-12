import { abilityScoreRepresentationSchema } from "@/lib/schemas/content-types/race";
import { abilityScoreArraySchema } from "@/lib/schemas/content-types/mechanical";
import type { MechanicalEffect, Effect } from "@/lib/types/effects";

export const RACE_ABILITY_SLUGS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export interface RaceAbilityData {
  scores?: number[];
  ability_score_representation?: { version: 1; mode: "effects" | "scores" };
}

/** Representation is a parsed semantic declaration, never proof of origin or
 * authority. Absent declaration intentionally keeps historical live additions.
 * Independent effects are never inspected, removed, compared or normalized. */
export function resolveRaceAbilityContributions(data?: RaceAbilityData): MechanicalEffect[] {
  if (!data) return [];
  const declaration = data.ability_score_representation;
  if (declaration !== undefined) {
    const parsed = abilityScoreRepresentationSchema.safeParse(declaration);
    if (!parsed.success || (data.scores !== undefined && !abilityScoreArraySchema.safeParse(data.scores).success)
      || (parsed.data.mode === "scores" && data.scores === undefined)) {
      throw new Error("Invalid race ability-score representation.");
    }
    if (parsed.data.mode === "effects") return [];
  }
  return (data.scores ?? []).slice(0, RACE_ABILITY_SLUGS.length).flatMap((value, index) => value !== 0
    ? [{ type: "mechanical" as const, stat: RACE_ABILITY_SLUGS[index], op: "add" as const, value }]
    : []);
}

export function hasLegacyRaceAbilityAmbiguity(data: RaceAbilityData | undefined, effects: Effect[]): boolean {
  return data?.ability_score_representation === undefined && Array.isArray(data?.scores) && data.scores.length === 6
    && data.scores.some(value => value !== 0)
    && effects.some(effect => effect.type === "mechanical" && RACE_ABILITY_SLUGS.some(slug => slug === effect.stat));
}
