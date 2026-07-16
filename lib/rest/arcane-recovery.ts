/**
 * Arcane Recovery — pure helpers, no React.
 *
 * Design: docs/specs/2026-07-15-m3-gameplay-foundations-design.md §4.6 (D8).
 *
 * During a short rest, a wizard with the Arcane Recovery feature unspent can
 * recover spell slots with combined levels ≤ ⌈wizard level / 2⌉, none 6th
 * level or higher, once per day. The once-per-day gate is the *existing*
 * feature-resource system: the `arcane-recovery` feature (enriched in
 * migration 00034 with `usages: 1, recovery: "long rest"`) surfaces as a
 * FeatureResource whose spent count lives in `state.feature_uses` — no
 * parallel tracker. A long rest resets it like every other long-rest resource.
 *
 * The slot restoration and the feature-use consumption are folded into the
 * short-rest patch (`mergeShortRestWithRecovery`) so the executed rest stays
 * ONE atomic `patchState` write.
 */

import type { CharacterState } from "@/lib/types/character";
import type { FeatureResource } from "@/lib/types/resources";
import type { MaxSlotsByLevel, SpellSlotsUsed } from "@/lib/types/spells";

/** Feature-resource slug (content slug of the wizard L1 feature). */
export const ARCANE_RECOVERY_SLUG = "arcane-recovery";

/** RAW: none of the recovered slots can be 6th level or higher. */
export const ARCANE_RECOVERY_MAX_SLOT_LEVEL = 5;

/** Slot level ("1".."5") → number of spent slots to restore at that level. */
export type ArcaneRecoveryPicks = Record<string, number>;

export interface ArcaneRecoveryInfo {
  /** Whether the recovery section should render (see computeArcaneRecoveryInfo). */
  available: boolean;
  /** Max combined slot levels recoverable: ⌈wizard level / 2⌉ (0 = no wizard levels). */
  budget: number;
  /** Slot levels 1–5 with at least one spent slot; value = spent count
   *  (clamped to the level's max, so stale slot state self-heals on read). */
  recoverableSlots: Record<string, number>;
}

export type ArcaneRecoveryValidation =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Level in the class that grants Arcane Recovery. Data-driven: reads
 * `data.class` off the feature's content ref (any homebrew reskin of the
 * feature scales with *its* class), defaulting to "wizard". Multiclass
 * characters use only that class's levels.
 */
export function arcaneRecoveryClassLevel(
  classes: Array<{ slug: string; level: number }>,
  contentRefs: Array<{
    content_definitions: {
      slug: string;
      content_type: string;
      data: Record<string, unknown>;
    } | null;
  }> = [],
): number {
  const ref = contentRefs.find(
    (r) =>
      r.content_definitions?.content_type === "feature" &&
      r.content_definitions?.slug === ARCANE_RECOVERY_SLUG,
  );
  const classSlug =
    (ref?.content_definitions?.data?.class as string | undefined) ?? "wizard";
  return classes.find((c) => c.slug === classSlug)?.level ?? 0;
}

/** ⌈wizardLevel / 2⌉ combined slot levels; 0 for a non-wizard. */
export function arcaneRecoveryBudget(wizardLevel: number): number {
  if (!Number.isFinite(wizardLevel) || wizardLevel < 1) return 0;
  return Math.ceil(wizardLevel / 2);
}

/** Combined slot levels of a picks map: Σ (level × count). */
export function totalPickedLevels(picks: ArcaneRecoveryPicks): number {
  let total = 0;
  for (const [key, count] of Object.entries(picks)) {
    const level = Number(key);
    if (!Number.isInteger(level) || level < 1) continue;
    if (!Number.isFinite(count) || count <= 0) continue;
    total += level * count;
  }
  return total;
}

/** Spent count at a leveled slot key, clamped to [0, max] (self-healing read). */
function spentAt(
  key: string,
  slotState: SpellSlotsUsed,
  maxSlots: MaxSlotsByLevel,
): number {
  const used = (slotState as Record<string, number>)[key] ?? 0;
  const max = (maxSlots as Record<string, number>)[key] ?? 0;
  return Math.min(Math.max(0, used), max);
}

/**
 * Derive the Arcane Recovery display/availability state for the short-rest
 * pane. `available` is true only when ALL of:
 *
 * - the `arcane-recovery` feature resource exists on the character,
 * - its use is not already spent (once per day — long rest resets it),
 * - the character has wizard levels (budget > 0), and
 * - at least one spent slot of level ≤ 5 is actually recoverable within the
 *   budget (a single slot of level L needs L ≤ budget).
 *
 * `recoverableSlots` lists every spent level ≤ 5 regardless of budget so the
 * picker can render rows whose steppers the live budget disables.
 */
export function computeArcaneRecoveryInfo(args: {
  wizardLevel: number;
  resources: FeatureResource[];
  state: CharacterState;
  maxSlots: MaxSlotsByLevel;
}): ArcaneRecoveryInfo {
  const { wizardLevel, resources, state, maxSlots } = args;

  const budget = arcaneRecoveryBudget(wizardLevel);
  const slotState = (state.spell_slots_used ?? {}) as SpellSlotsUsed;

  const recoverableSlots: Record<string, number> = {};
  for (let level = 1; level <= ARCANE_RECOVERY_MAX_SLOT_LEVEL; level++) {
    const key = String(level);
    const spent = spentAt(key, slotState, maxSlots);
    if (spent > 0) recoverableSlots[key] = spent;
  }

  const resource = resources.find((r) => r.slug === ARCANE_RECOVERY_SLUG);
  const uses = (state.feature_uses ?? {}) as Record<string, number>;
  const unspent =
    resource !== undefined && (uses[ARCANE_RECOVERY_SLUG] ?? 0) < resource.max;

  const anyPickable = Object.keys(recoverableSlots).some(
    (key) => Number(key) <= budget,
  );

  return {
    available: unspent && budget > 0 && anyPickable,
    budget,
    recoverableSlots,
  };
}

/**
 * Validate a picks map against RAW: leveled slots only (no pact), none 6th+,
 * counts must not exceed what is actually spent, combined levels ≤ budget.
 * Negative/fractional counts are rejected; zero counts are ignored.
 */
export function validateArcaneRecoveryPicks(
  picks: ArcaneRecoveryPicks,
  budget: number,
  maxSlots: MaxSlotsByLevel,
  slotState: SpellSlotsUsed,
): ArcaneRecoveryValidation {
  for (const [key, count] of Object.entries(picks)) {
    if (count === 0) continue;
    if (!Number.isInteger(count) || count < 0) {
      return {
        valid: false,
        reason: `Pick count for slot level ${key} must be a non-negative integer.`,
      };
    }
    const level = Number(key);
    if (!Number.isInteger(level) || level < 1 || level > 9) {
      return {
        valid: false,
        reason: `"${key}" is not a leveled spell slot — Arcane Recovery cannot restore it.`,
      };
    }
    if (level > ARCANE_RECOVERY_MAX_SLOT_LEVEL) {
      return {
        valid: false,
        reason: "Arcane Recovery cannot restore slots of 6th level or higher.",
      };
    }
    const spent = spentAt(key, slotState, maxSlots);
    if (count > spent) {
      return {
        valid: false,
        reason: `Only ${spent} spent slot${spent === 1 ? "" : "s"} of level ${level} to recover.`,
      };
    }
  }

  const total = totalPickedLevels(picks);
  if (total > budget) {
    return {
      valid: false,
      reason: `Picked ${total} combined slot levels — budget is ${budget}.`,
    };
  }

  return { valid: true };
}

/**
 * State patch for applying the picks: restore exactly the picked
 * `spell_slots_used` keys (decrement used count, floored at 0) and spend the
 * feature use (`feature_uses["arcane-recovery"] = 1`). Returns `{}` when
 * nothing is picked — a short rest without picks must not touch the resource.
 */
export function computeArcaneRecoveryPatch(
  state: CharacterState,
  picks: ArcaneRecoveryPicks,
): Partial<CharacterState> {
  if (totalPickedLevels(picks) <= 0) return {};

  const slots = { ...(state.spell_slots_used ?? {}) } as Record<string, number>;
  for (const [key, count] of Object.entries(picks)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    slots[key] = Math.max(0, (slots[key] ?? 0) - count);
  }

  const uses = { ...(state.feature_uses ?? {}) } as Record<string, number>;
  uses[ARCANE_RECOVERY_SLUG] = 1;

  return {
    spell_slots_used: slots as CharacterState["spell_slots_used"],
    feature_uses: uses,
  };
}

/**
 * Fold Arcane Recovery picks into a computed short-rest patch, producing ONE
 * combined patch for a single `patchState` write. The recovery patch is
 * computed against the state *as the rest patch leaves it*, so overlapping
 * maps (`spell_slots_used` with a pact reset, `feature_uses` with short-rest
 * resources zeroed) merge instead of clobbering each other. With no effective
 * picks the rest patch passes through untouched.
 */
export function mergeShortRestWithRecovery(
  state: CharacterState,
  restPatch: Partial<CharacterState>,
  picks: ArcaneRecoveryPicks,
): Partial<CharacterState> {
  if (totalPickedLevels(picks) <= 0) return restPatch;
  const afterRest = { ...state, ...restPatch } as CharacterState;
  return { ...restPatch, ...computeArcaneRecoveryPatch(afterRest, picks) };
}
