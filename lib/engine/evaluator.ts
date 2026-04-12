import type {
  Effect,
  MechanicalEffect,
  NarrativeEffect,
  GrantEffect,
} from "@/lib/types/effects";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { SpeedData, VisionEntry, SavetxtData } from "@/lib/schemas/content-types/mechanical";
import { sortEffectsByPriority } from "@/lib/engine/effects";
import { parseExpression } from "@/lib/engine/parser";

// ---------------------------------------------------------------------------
// Structured data types for Phase 1 mechanical aggregation
// ---------------------------------------------------------------------------

/** Structured data sourced from content ref JSONB `data` fields (race, features, class). */
export interface StructuredSources {
  raceData?: {
    scores?: number[];
    speed_detail?: SpeedData;
    speed?: number;
    vision?: VisionEntry[];
    dmgres?: string[];
    savetxt?: SavetxtData;
  };
  featureData?: Array<{
    speed?: SpeedData;
    vision?: VisionEntry[];
    dmgres?: string[];
    savetxt?: SavetxtData;
  }>;
  classData?: {
    attacks?: number[];
    improvements?: boolean[];
  };
  level?: number;
}

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export interface EvaluationResult {
  stats: Record<string, number>;
  computed: Record<string, number>;
  narratives: NarrativeEffect[];
  grants: GrantEffect[];
  // Phase 1 aggregates from structured content ref data
  speed: SpeedData;
  vision: VisionEntry[];
  dmgres: string[];
  savetxt: SavetxtData;
  attacks: number;
  improvements: boolean;
}

// ---------------------------------------------------------------------------
// Structured data aggregation
// ---------------------------------------------------------------------------

const ABILITY_SLUGS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

function collectStructuredData(sources?: StructuredSources): {
  speed: SpeedData;
  vision: VisionEntry[];
  dmgres: string[];
  savetxt: SavetxtData;
  attacks: number;
  improvements: boolean;
} {
  if (!sources) {
    return {
      speed: { walk: 30 },
      vision: [],
      dmgres: [],
      savetxt: { adv_vs: [], immune: [] },
      attacks: 1,
      improvements: false,
    };
  }

  const level = sources.level ?? 1;
  const race = sources.raceData;

  // --- Speed: start from race, add feature bonuses ---
  const speed: SpeedData = { ...(race?.speed_detail ?? (race?.speed ? { walk: race.speed } : { walk: 30 })) };
  for (const feat of sources.featureData ?? []) {
    if (feat.speed) {
      for (const [key, val] of Object.entries(feat.speed) as [keyof SpeedData, number | undefined][]) {
        if (val != null) {
          speed[key] = (speed[key] ?? 0) + val;
        }
      }
    }
  }

  // --- Vision: concatenate and deduplicate by type (keep highest range) ---
  const visionMap = new Map<string, VisionEntry>();
  for (const entry of race?.vision ?? []) {
    const existing = visionMap.get(entry.type);
    if (!existing || entry.range > existing.range) {
      visionMap.set(entry.type, entry);
    }
  }
  for (const feat of sources.featureData ?? []) {
    for (const entry of feat.vision ?? []) {
      const existing = visionMap.get(entry.type);
      if (!existing || entry.range > existing.range) {
        visionMap.set(entry.type, entry);
      }
    }
  }
  const vision = Array.from(visionMap.values());

  // --- Damage resistances: union, deduplicated ---
  const dmgresSet = new Set<string>(race?.dmgres ?? []);
  for (const feat of sources.featureData ?? []) {
    for (const res of feat.dmgres ?? []) {
      dmgresSet.add(res);
    }
  }
  const dmgres = Array.from(dmgresSet);

  // --- Save text: merge adv_vs and immune arrays ---
  const advVsSet = new Set<string>(race?.savetxt?.adv_vs ?? []);
  const immuneSet = new Set<string>(race?.savetxt?.immune ?? []);
  for (const feat of sources.featureData ?? []) {
    for (const adv of feat.savetxt?.adv_vs ?? []) advVsSet.add(adv);
    for (const imm of feat.savetxt?.immune ?? []) immuneSet.add(imm);
  }
  const savetxt: SavetxtData = {
    adv_vs: Array.from(advVsSet),
    immune: Array.from(immuneSet),
  };

  // --- Attacks: lookup from class data ---
  const attacks = sources.classData?.attacks?.[level - 1] ?? 1;

  // --- Improvements: lookup from class data ---
  const improvements = sources.classData?.improvements?.[level - 1] ?? false;

  return { speed, vision, dmgres, savetxt, attacks, improvements };
}

/**
 * Generate mechanical effects from race ability score bonuses.
 * Converts the [STR, DEX, CON, INT, WIS, CHA] array into add effects.
 */
function raceScoreEffects(scores: number[]): MechanicalEffect[] {
  const effects: MechanicalEffect[] = [];
  for (let i = 0; i < scores.length && i < ABILITY_SLUGS.length; i++) {
    if (scores[i] !== 0) {
      effects.push({
        type: "mechanical",
        stat: ABILITY_SLUGS[i],
        op: "add",
        value: scores[i],
      });
    }
  }
  return effects;
}

// ---------------------------------------------------------------------------
// Core evaluation pipeline
// ---------------------------------------------------------------------------

/**
 * Core evaluation pipeline:
 * 1. Separate effects by type (mechanical, narrative, grant)
 * 2. Split mechanical into static (Tier 1) and formula (Tier 2)
 * 3. Apply static effects to base stats (set -> add -> multiply, etc.)
 * 4. Compute derived stats from schema formulas using the parser
 * 5. Apply static effects that target derived stats (e.g., movement_speed bonuses)
 * 6. Apply formula effects (Tier 2) last
 * 7. Collect structured data from content ref sources
 * 8. Return { stats, computed, narratives, grants, speed, vision, dmgres, savetxt, attacks, improvements }
 */
export function evaluate(
  baseStats: Record<string, number>,
  effects: Effect[],
  schema: SystemSchemaDefinition,
  sources?: StructuredSources,
): EvaluationResult {
  // 0. Prepend race score bonus effects if available
  const allEffects = [...effects];
  if (sources?.raceData?.scores) {
    allEffects.unshift(...raceScoreEffects(sources.raceData.scores));
  }

  // 1. Separate effects by type
  const mechanical: MechanicalEffect[] = [];
  const narratives: NarrativeEffect[] = [];
  const grants: GrantEffect[] = [];

  for (const effect of allEffects) {
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

  // 8. Collect structured data from content ref sources
  const structured = collectStructuredData(sources);

  return { stats, computed, narratives, grants, ...structured };
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
