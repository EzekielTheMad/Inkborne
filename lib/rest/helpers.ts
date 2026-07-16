import type { CharacterState } from "@/lib/types/character";
import type { FeatureResource } from "@/lib/types/resources";
import {
  computeLongRestHdRecovery,
  type HitDicePool,
} from "@/lib/hit-dice/helpers";

export interface RestEffects {
  statePatch: Partial<CharacterState>;
  canApply: boolean;
}

/**
 * Compute the state patch for a short rest.
 *
 * Applies:
 * - `spell_slots_used.pact = 0` (if pact key exists and is > 0)
 * - Zero every `feature_uses[slug]` where the resource has `recovery === "short"`
 *
 * Does NOT touch: HP, temp HP, death saves, exhaustion, concentration,
 * regular (leveled 1-9) spell slots, long-rest resources.
 *
 * `canApply` is true when any field would actually change.
 */
export function computeShortRestEffects(
  state: CharacterState,
  resources: FeatureResource[],
): RestEffects {
  const patch: Partial<CharacterState> = {};

  // Pact slot restoration
  const slots = state.spell_slots_used ?? {};
  const pactUsed = (slots.pact as number | undefined) ?? 0;
  if (pactUsed > 0) {
    patch.spell_slots_used = { ...slots, pact: 0 };
  }

  // Short-rest feature resources
  const shortSlugs = resources
    .filter((r) => r.recovery === "short")
    .map((r) => r.slug);
  const uses = (state.feature_uses ?? {}) as Record<string, number>;
  const hasShortUsed = shortSlugs.some((slug) => (uses[slug] ?? 0) > 0);
  if (hasShortUsed) {
    const nextUses: Record<string, number> = { ...uses };
    for (const slug of shortSlugs) nextUses[slug] = 0;
    patch.feature_uses = nextUses;
  }

  return {
    statePatch: patch,
    canApply: Object.keys(patch).length > 0,
  };
}

/**
 * Compute the state patch for a long rest.
 *
 * Applies:
 * - `current_hp = maxHp`
 * - `temp_hp = 0`
 * - `death_saves = { successes: 0, failures: 0 }`
 * - `exhaustion = max(0, (state.exhaustion ?? 0) - 1)`
 * - `concentrating_on = null`
 * - `active_effects = []` (8+ in-game hours outlasts every non-`special`
 *   duration; re-applying "until dispelled" effects is the honest default)
 * - All `spell_slots_used[*]` → 0 (includes pact)
 * - All `feature_uses[slug]` → 0 where recovery is "short" OR "long"
 * - `hit_dice_spent` recovery when `hitDicePools` is provided and any dice
 *   are spent: restore ⌊total HD / 2⌋ (min 1), largest die first (RAW; the
 *   allocation lives in computeLongRestHdRecovery). The rebuilt map is keyed
 *   from the pools, so stale keys from removed classes self-heal away.
 *
 * Does NOT touch: conditions (other than exhaustion), currency, inventory,
 * notes. Short rests leave active effects alone (RAW: concentration and
 * buffs can persist through an hour).
 */
export function computeLongRestEffects(
  state: CharacterState,
  maxHp: number,
  resources: FeatureResource[],
  hitDicePools: HitDicePool[] = [],
): RestEffects {
  const currentHp = state.current_hp ?? maxHp;
  const tempHp = state.temp_hp ?? 0;
  const deathSaves = state.death_saves ?? { successes: 0, failures: 0 };
  const exhaustion = state.exhaustion ?? 0;
  const concentrating = state.concentrating_on ?? null;
  const activeEffects = state.active_effects ?? [];
  const slots = (state.spell_slots_used ?? {}) as Record<string, number>;
  const uses = (state.feature_uses ?? {}) as Record<string, number>;

  // Spell slots reset: zero every existing key
  const zeroedSlots: Record<string, number> = {};
  for (const key of Object.keys(slots)) zeroedSlots[key] = 0;
  const slotsChanged = Object.values(slots).some((v) => v > 0);

  // Feature uses reset: zero every resource slug (short + long)
  const allResourceSlugs = resources.map((r) => r.slug);
  const zeroedUses: Record<string, number> = { ...uses };
  let usesChanged = false;
  for (const slug of allResourceSlugs) {
    if ((uses[slug] ?? 0) > 0) {
      zeroedUses[slug] = 0;
      usesChanged = true;
    }
  }

  const patch: Partial<CharacterState> = {
    current_hp: maxHp,
    temp_hp: 0,
    death_saves: { successes: 0, failures: 0 },
    exhaustion: Math.max(0, exhaustion - 1),
    concentrating_on: null,
    active_effects: [],
    spell_slots_used: zeroedSlots,
    feature_uses: zeroedUses,
  };

  // Hit-dice recovery: ⌊total/2⌋ min 1, largest die first. Only included in
  // the patch when something is actually spent (keeps the patch minimal and
  // legacy no-pool callers untouched).
  const hdSpent = hitDicePools.some((p) => p.spent > 0);
  if (hdSpent) {
    const recovery = computeLongRestHdRecovery(hitDicePools);
    const nextSpent: Record<string, number> = {};
    for (const pool of hitDicePools) {
      nextSpent[pool.classSlug] = Math.max(
        0,
        pool.spent - (recovery[pool.classSlug] ?? 0),
      );
    }
    patch.hit_dice_spent = nextSpent;
  }

  // Detect no-op: every field would be unchanged
  const canApply =
    currentHp !== maxHp ||
    tempHp !== 0 ||
    deathSaves.successes !== 0 ||
    deathSaves.failures !== 0 ||
    exhaustion > 0 ||
    concentrating !== null ||
    activeEffects.length > 0 ||
    slotsChanged ||
    usesChanged ||
    hdSpent;

  return { statePatch: patch, canApply };
}
