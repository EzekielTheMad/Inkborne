import type { StateCondition } from "@/lib/types/effects";

const STATE_DEFAULTS: Record<string, string | boolean> = {
  equipped_armor: "none",
  shield_equipped: false,
  rage_active: false,
};

export function checkCondition(
  condition: StateCondition | StateCondition[] | undefined,
  state: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  const conditions = Array.isArray(condition) ? condition : [condition];
  return conditions.every((c) => {
    const actual = state[c.field] ?? STATE_DEFAULTS[c.field] ?? null;
    switch (c.op) {
      case "eq":
        return actual === c.value;
      case "neq":
        return actual !== c.value;
      default:
        return true;
    }
  });
}
