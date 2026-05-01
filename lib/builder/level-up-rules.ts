import type { HpRollRecord, HpRule } from "@/lib/types/character";

export type { HpRule } from "@/lib/types/character";

export interface HpContributionInput {
  classSlug: string;
  level: number;
  /** Hit die value, e.g. 10 for d10. */
  die: number;
  /** True only when this is level 1 AND the class is the primary (first) class. */
  isFirstLevelOfPrimary: boolean;
  /** True for level === 1 of any class. */
  isFirstLevelOfClass: boolean;
  storedRoll: HpRollRecord | undefined;
  rule: HpRule;
}

export function resolveHpRule(
  campaignRule: HpRule | null | undefined,
  systemRule: HpRule | null | undefined,
): HpRule {
  return campaignRule ?? systemRule ?? "free_choice";
}

function averageHitDie(die: number): number {
  return Math.floor(die / 2) + 1;
}

export function hpContributionForLevel(input: HpContributionInput): number {
  const { die, isFirstLevelOfPrimary, isFirstLevelOfClass, storedRoll, rule } = input;

  if (isFirstLevelOfPrimary) return die;
  if (rule === "max_for_all") return die;
  if (rule === "max_first_level_each_class" && isFirstLevelOfClass) return die;
  if (rule === "average_only") return averageHitDie(die);
  if (rule === "rolled_only") {
    return storedRoll?.value ?? averageHitDie(die);
  }
  return storedRoll?.value ?? averageHitDie(die);
}
