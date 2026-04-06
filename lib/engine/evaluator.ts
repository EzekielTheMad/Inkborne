import type {
  Effect,
  MechanicalEffect,
  NarrativeEffect,
  GrantEffect,
} from "@/lib/types/effects";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { sortEffectsByPriority } from "@/lib/engine/effects";
import { parseExpression } from "@/lib/engine/parser";

export interface EvaluationResult {
  stats: Record<string, number>;
  computed: Record<string, number>;
  narratives: NarrativeEffect[];
  grants: GrantEffect[];
}

/**
 * Core evaluation pipeline:
 * 1. Separate effects by type (mechanical, narrative, grant)
 * 2. Split mechanical into static (Tier 1) and formula (Tier 2)
 * 3. Apply static effects to base stats (set -> add -> multiply, etc.)
 * 4. Compute derived stats from schema formulas using the parser
 * 5. Apply static effects that target derived stats (e.g., movement_speed bonuses)
 * 6. Apply formula effects (Tier 2) last
 * 7. Return { stats, computed, narratives, grants }
 */
export function evaluate(
  baseStats: Record<string, number>,
  effects: Effect[],
  schema: SystemSchemaDefinition,
): EvaluationResult {
  // 1. Separate effects by type
  const mechanical: MechanicalEffect[] = [];
  const narratives: NarrativeEffect[] = [];
  const grants: GrantEffect[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case "mechanical":
        mechanical.push(effect);
        break;
      case "narrative":
        narratives.push(effect);
        break;
      case "grant":
        grants.push(effect);
        break;
    }
  }

  // 2. Split mechanical into static (Tier 1) and formula (Tier 2)
  const staticEffects: MechanicalEffect[] = [];
  const formulaEffects: MechanicalEffect[] = [];

  for (const effect of mechanical) {
    if (effect.op === "formula") {
      formulaEffects.push(effect);
    } else {
      staticEffects.push(effect);
    }
  }

  // 3. Sort static effects by priority and split into base-stat vs derived-stat targets
  const sorted = sortEffectsByPriority(staticEffects);

  const derivedStatSlugs = new Set(schema.derived_stats.map((d) => d.slug));

  const baseStatEffects: MechanicalEffect[] = [];
  const derivedStatEffects: MechanicalEffect[] = [];

  for (const effect of sorted) {
    if (derivedStatSlugs.has(effect.stat)) {
      derivedStatEffects.push(effect);
    } else {
      baseStatEffects.push(effect);
    }
  }

  // 4. Apply static effects to base stats
  const stats = { ...baseStats };
  applyStaticEffects(stats, baseStatEffects);

  // 5. Build builtins and compute derived stats
  const computed: Record<string, number> = {};

  const builtins: Record<string, (...args: unknown[]) => number> = {
    mod: (score: unknown) => Math.floor((Number(score) - 10) / 2),
    proficiency_if: (skill: unknown) => {
      const hasGrant = grants.some(
        (g) => g.stat === String(skill) && g.value === "proficient",
      );
      return hasGrant ? (computed.proficiency_bonus ?? 0) : 0;
    },
  };

  // Evaluate derived stats in order (later stats can reference earlier ones)
  for (const def of schema.derived_stats) {
    if (def.formula) {
      // Merge base stats + already-computed derived stats for the expression context
      const context = { ...stats, ...computed };
      computed[def.slug] = parseExpression(def.formula, context, builtins);
    } else if (def.base !== undefined) {
      computed[def.slug] = def.base;
    }
  }

  // 6. Apply static effects targeting derived stats
  applyStaticEffects(computed, derivedStatEffects);

  // 7. Apply formula effects (Tier 2) last
  for (const effect of formulaEffects) {
    if (effect.expr) {
      const context = { ...stats, ...computed };
      const value = parseExpression(effect.expr, context, builtins);
      if (effect.stat in computed) {
        computed[effect.stat] = value;
      } else {
        stats[effect.stat] = value;
      }
    }
  }

  return { stats, computed, narratives, grants };
}

/** Apply a sorted list of static mechanical effects to a stats record in-place. */
function applyStaticEffects(
  stats: Record<string, number>,
  effects: MechanicalEffect[],
): void {
  for (const effect of effects) {
    const current = stats[effect.stat] ?? 0;
    const value = typeof effect.value === "number" ? effect.value : 0;

    switch (effect.op) {
      case "set":
        stats[effect.stat] = value;
        break;
      case "add":
        stats[effect.stat] = current + value;
        break;
      case "multiply":
        stats[effect.stat] = current * value;
        break;
      case "max":
        stats[effect.stat] = Math.max(current, value);
        break;
      case "min":
        stats[effect.stat] = Math.min(current, value);
        break;
    }
  }
}
