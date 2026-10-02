/** Rules already offered by the ability editor. Base scores exclude racial/ASI effects. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

/** Validates saved data, not an in-flight request or overall character readiness. */
export function hasCompleteAbilityScores(
  method: string | undefined,
  scores: Record<string, number>,
  requiredAbilities: readonly { slug: string }[] | undefined,
  allowedMethods?: readonly string[],
): boolean {
  if (!method || !requiredAbilities?.length ||
    (allowedMethods && !allowedMethods.includes(method))) return false;
  const values = requiredAbilities.map(({ slug }) => scores[slug]);
  if (!values.every(value => Number.isInteger(value) && value >= 1 && value <= 30)) return false;
  switch (method) {
    case "manual": return true;
    case "standard_array":
      return values.every(value => STANDARD_ARRAY.includes(value)) && new Set(values).size === values.length;
    case "point_buy":
      return values.every(value => value >= 8 && value <= 15) &&
        values.reduce((cost, value) => cost + POINT_BUY_COSTS[value], 0) <= POINT_BUY_BUDGET;
    default: return false;
  }
}
