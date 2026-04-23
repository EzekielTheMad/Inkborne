// Maximum HP computation for D&D 5e characters.
//
// Why a standalone helper instead of the engine's derived-stat formula?
// The schema defines `hit_points_max` as `hit_die_total + (mod(constitution) * level)`,
// but `hit_die_total` is per-class and can't be expressed by the existing expression
// parser (which operates on scalar stats). Computing HP directly in TypeScript with
// access to class content is cleaner than extending the parser to handle class
// iteration.
//
// RAW (Player's Handbook, multiclassing):
//  - First (primary) class, level 1: gain MAX of hit die
//  - All other levels (including multiclass L1s): gain average of hit die
//  - Average hit die = floor(die/2) + 1 → d6=4, d8=5, d10=6, d12=7
//  - CON modifier applied per character level (total)
//  - Minimum +1 HP per level even if CON modifier is very negative

interface ClassChoice {
  slug: string;
  level: number;
}

interface ClassContentEntry {
  slug: string;
  data: Record<string, unknown>;
}

/** Average hit die roll per RAW: floor(die/2) + 1. */
function averageHitDie(die: number): number {
  return Math.floor(die / 2) + 1;
}

/** Standard D&D 5e ability-score-to-modifier function. */
function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Compute maximum hit points for a character.
 *
 * @param classes Character's class choices in order taken. `classes[0]` is the primary class.
 * @param classContent Map of class slug → content definition (with `data.hit_die`).
 * @param constitutionScore Character's current CON score (post-effects).
 * @returns Total maximum hit points. Returns 0 if no classes.
 */
export function computeMaxHp(
  classes: ClassChoice[],
  classContent: Record<string, ClassContentEntry>,
  constitutionScore: number,
): number {
  if (classes.length === 0) return 0;
  const conMod = abilityMod(constitutionScore);

  let total = 0;
  classes.forEach((cls, classIndex) => {
    const entry = classContent[cls.slug];
    const hitDie =
      typeof entry?.data?.hit_die === "number" ? (entry.data.hit_die as number) : 8;
    const avg = averageHitDie(hitDie);
    const isPrimary = classIndex === 0;

    for (let level = 1; level <= cls.level; level++) {
      const isFirstLevelOfPrimary = isPrimary && level === 1;
      const baseContribution = isFirstLevelOfPrimary ? hitDie : avg;
      total += Math.max(1, baseContribution + conMod);
    }
  });

  return total;
}
