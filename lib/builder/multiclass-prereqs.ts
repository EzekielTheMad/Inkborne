import type { ContentEntry } from "@/components/builder/content-browser";

export type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

interface MulticlassPrereq {
  /** All abilities listed must meet the threshold (`AND`). Used for most classes. */
  all?: Array<{ ability: AbilityKey; min: number }>;
  /** At least one ability must meet the threshold (`OR`). Used for Fighter (STR 13 OR DEX 13). */
  any?: Array<{ ability: AbilityKey; min: number }>;
}

export const MULTICLASS_PREREQ_TABLE: Record<string, MulticlassPrereq> = {
  barbarian: { all: [{ ability: "strength", min: 13 }] },
  bard: { all: [{ ability: "charisma", min: 13 }] },
  cleric: { all: [{ ability: "wisdom", min: 13 }] },
  druid: { all: [{ ability: "wisdom", min: 13 }] },
  fighter: { any: [{ ability: "strength", min: 13 }, { ability: "dexterity", min: 13 }] },
  monk: { all: [{ ability: "dexterity", min: 13 }, { ability: "wisdom", min: 13 }] },
  paladin: { all: [{ ability: "strength", min: 13 }, { ability: "charisma", min: 13 }] },
  ranger: { all: [{ ability: "dexterity", min: 13 }, { ability: "wisdom", min: 13 }] },
  rogue: { all: [{ ability: "dexterity", min: 13 }] },
  sorcerer: { all: [{ ability: "charisma", min: 13 }] },
  warlock: { all: [{ ability: "charisma", min: 13 }] },
  wizard: { all: [{ ability: "intelligence", min: 13 }] },
};

export type ClassPrereqState = "met" | "not-met" | "already-in-build";

export interface ClassPrereqResult {
  classSlug: string;
  state: ClassPrereqState;
  /** Human-readable line: e.g. "STR 13 · met", "STR 13 · not met", "Already in this build". */
  line: string;
  /** When state is not-met, lists which abilities failed. Empty for met / already-in-build. */
  unmet?: Array<{ ability: AbilityKey; min: number; have: number }>;
}

const ABILITY_ABBR: Record<AbilityKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

function abbr(ability: AbilityKey): string {
  return ABILITY_ABBR[ability];
}

export function evaluateMulticlassPrereq(
  classSlug: string,
  resolvedStats: Record<string, number>,
  selectedClasses: Array<{ slug: string }>,
): ClassPrereqResult {
  if (selectedClasses.some((c) => c.slug === classSlug)) {
    return {
      classSlug,
      state: "already-in-build",
      line: "Already in this build",
    };
  }

  const prereq = MULTICLASS_PREREQ_TABLE[classSlug];
  if (!prereq) {
    return { classSlug, state: "met", line: "" };
  }

  if (prereq.all) {
    const unmet = prereq.all
      .map((req) => ({ ...req, have: resolvedStats[req.ability] ?? 0 }))
      .filter((req) => req.have < req.min);

    if (unmet.length === 0) {
      const primary = prereq.all[0];
      return {
        classSlug,
        state: "met",
        line: `${abbr(primary.ability)} ${primary.min} · met`,
      };
    }

    const primaryUnmet = unmet[0];
    return {
      classSlug,
      state: "not-met",
      line: `${abbr(primaryUnmet.ability)} ${primaryUnmet.min} · not met`,
      unmet,
    };
  }

  // `any` form (Fighter): at least one threshold must hit.
  const checks = (prereq.any ?? []).map((req) => ({
    ...req,
    have: resolvedStats[req.ability] ?? 0,
  }));
  const hit = checks.find((req) => req.have >= req.min);

  if (hit) {
    return {
      classSlug,
      state: "met",
      line: `${abbr(hit.ability)} ${hit.min} · met`,
    };
  }

  const summary = checks.map((c) => `${abbr(c.ability)} ${c.min}`).join(" or ");
  return {
    classSlug,
    state: "not-met",
    line: `${summary} · not met`,
    unmet: checks,
  };
}

export function multiclassPrereqsForAll(
  resolvedStats: Record<string, number>,
  selectedClasses: Array<{ slug: string }>,
  classes: ContentEntry[],
): ClassPrereqResult[] {
  return classes.map((c) => evaluateMulticlassPrereq(c.slug, resolvedStats, selectedClasses));
}
