import type { CharacterDeathSaves, CharacterState } from "@/lib/types/character";

// ---------------------------------------------------------------------------
// RAW death-save resolution (design D9, §3.6). Pure: takes the current saves
// and an executed roll, returns ONE state patch for a single `patchState`
// call. The dice never write state themselves — the component applies the
// patch as an explicit user action.
// ---------------------------------------------------------------------------

export type DeathSaveOutcome =
  /** Natural 20 — regain 1 HP; saves reset (same semantics as the 0→>0 heal). */
  | "revive"
  /** Total ≥ 10. */
  | "success"
  /** Total < 10. */
  | "failure"
  /** Natural 1 — two failures. */
  | "critical_failure";

export interface DeathSaveResolution {
  outcome: DeathSaveOutcome;
  /** Apply with exactly one `patchState` call. */
  patch: Partial<CharacterState>;
}

/**
 * Resolve a rolled death save per RAW:
 * - natural 20 → regain 1 HP, saves reset to 0/0
 * - natural 1  → two failures
 * - total ≥ 10 → one success
 * - total < 10 → one failure
 *
 * `total` (not `natural`) decides success — riders like Bless's +1d4 legally
 * apply to death saves (they are saving throws RAW). Pips clamp at 3; the
 * stabilized/dead display reads the clamped values.
 */
export function resolveDeathSave(
  saves: CharacterDeathSaves,
  roll: { natural?: number; total: number },
): DeathSaveResolution {
  if (roll.natural === 20) {
    return {
      outcome: "revive",
      patch: {
        current_hp: 1,
        death_saves: { successes: 0, failures: 0 },
      },
    };
  }

  if (roll.natural === 1) {
    return {
      outcome: "critical_failure",
      patch: {
        death_saves: {
          successes: saves.successes,
          failures: Math.min(3, saves.failures + 2),
        },
      },
    };
  }

  if (roll.total >= 10) {
    return {
      outcome: "success",
      patch: {
        death_saves: {
          successes: Math.min(3, saves.successes + 1),
          failures: saves.failures,
        },
      },
    };
  }

  return {
    outcome: "failure",
    patch: {
      death_saves: {
        successes: saves.successes,
        failures: Math.min(3, saves.failures + 1),
      },
    },
  };
}
