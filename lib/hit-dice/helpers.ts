/**
 * Hit-dice tracking helpers — pure, no React.
 *
 * Design: docs/specs/2026-07-15-m3-gameplay-foundations-design.md §5 (D7).
 *
 * State shape: `state.hit_dice_spent: Record<classSlug, number>` — spent is
 * tracked, max is computed (max per class = class level, die size from class
 * content `hit_die`). The same self-healing convention as `feature_uses` and
 * `spell_slots_used`: a level-down clamps on read.
 *
 * Long rest restores ⌊total HD / 2⌋ (min 1) spent dice, largest die first —
 * a deterministic stand-in for RAW's "player chooses"; predictable and
 * optimal in practice.
 */

import type { CharacterState } from "@/lib/types/character";
import type { RollRequest } from "@/lib/dice/types";

/** One per-class hit-dice pool, fully derived for display + spending. */
export interface HitDicePool {
  classSlug: string;
  /** Die size, e.g. 10 for a d10. */
  die: number;
  /** Maximum dice in the pool = class level. */
  max: number;
  /** Dice spent, clamped to [0, max] on read. */
  spent: number;
}

interface ClassChoiceLike {
  slug: string;
  level: number;
}

/** Minimal shape of the class-content map (`ClassContentData` in the
 *  character context nests content under `.data`). */
type ClassContentLike = Record<
  string,
  { data?: { hit_die?: unknown } } | undefined
>;

/** Defensive fallback when class content is missing `hit_die`. */
const DEFAULT_HIT_DIE = 8;

/**
 * Derive per-class hit-dice pools from class choices, class content, and the
 * spent map in character state.
 *
 * - `max` = class level; `die` = class content `data.hit_die`.
 * - Stale spent values (e.g. after a level-down) clamp to [0, max] on read.
 * - Missing/invalid `hit_die` defaults to d8 with a console warning.
 */
export function computeHitDicePools(
  classes: ClassChoiceLike[],
  classContent: ClassContentLike,
  state: CharacterState,
): HitDicePool[] {
  const spentMap = state.hit_dice_spent ?? {};

  return classes.map((cls) => {
    const rawDie = classContent[cls.slug]?.data?.hit_die;
    let die: number;
    if (typeof rawDie === "number" && Number.isInteger(rawDie) && rawDie >= 1) {
      die = rawDie;
    } else {
      console.warn(
        `[hit-dice] Class "${cls.slug}" has no valid hit_die in content data — defaulting to d${DEFAULT_HIT_DIE}`,
      );
      die = DEFAULT_HIT_DIE;
    }

    const max = Math.max(0, Math.floor(cls.level));
    const rawSpent = spentMap[cls.slug] ?? 0;
    const spent = Math.min(max, Math.max(0, Math.floor(rawSpent)));

    return { classSlug: cls.slug, die, max, spent };
  });
}

/**
 * Compute how many spent hit dice a long rest restores per class.
 *
 * RAW: regain spent hit dice up to half your total number of them (min 1).
 * Budget = max(1, ⌊Σ max / 2⌋), allocated to pools with spent dice in
 * descending die-size order. Returns `{}` when nothing is spent; classes
 * recovering 0 dice are absent from the result.
 */
export function computeLongRestHdRecovery(
  pools: HitDicePool[],
): Record<string, number> {
  const totalMax = pools.reduce((sum, p) => sum + p.max, 0);
  if (totalMax === 0) return {};

  let budget = Math.max(1, Math.floor(totalMax / 2));
  const recovery: Record<string, number> = {};

  // Largest die first; ties broken by more-spent-first for determinism.
  const byDieDesc = [...pools].sort(
    (a, b) => b.die - a.die || b.spent - a.spent,
  );

  for (const pool of byDieDesc) {
    if (budget <= 0) break;
    const recovered = Math.min(pool.spent, budget);
    if (recovered > 0) {
      recovery[pool.classSlug] = recovered;
      budget -= recovered;
    }
  }

  return recovery;
}

/**
 * Build the RollRequest for spending one hit die from a pool: `1dX + conMod`
 * (`1dX` when the modifier is 0, `1dX-N` when negative). Kind `hit_die`, so
 * the roll toasts and lands in the log like every other roll.
 */
export function buildHitDieRollRequest(
  pool: HitDicePool,
  conMod: number,
): RollRequest {
  const modPart = conMod > 0 ? `+${conMod}` : conMod < 0 ? `${conMod}` : "";
  return {
    kind: "hit_die",
    label: `Hit Die (d${pool.die}) — ${formatClassSlug(pool.classSlug)}`,
    expression: `1d${pool.die}${modPart}`,
    meta: { class_slug: pool.classSlug, con_mod: conMod },
  };
}

/**
 * Compute the single atomic state patch for spending one hit die: the spend
 * (`hit_dice_spent[classSlug]` +1) and the heal (`current_hp` clamped to
 * `maxHp`) land in ONE patch — never two writes.
 *
 * Con-mod floor: a negative roll total (e.g. `1d6-3` rolling a 1) never
 * damages the character — healing floors at 0 while the die is still spent.
 *
 * Mirrors the HP tracker's heal semantics: healing from 0 to >0 resets death
 * saves in the same patch.
 */
export function spendHitDiePatch(
  state: CharacterState,
  classSlug: string,
  rollTotal: number,
  maxHp: number,
): Partial<CharacterState> {
  const spentMap = state.hit_dice_spent ?? {};
  const currentHp = state.current_hp ?? maxHp;
  const healed = Math.max(0, rollTotal);
  const newHp = Math.min(maxHp, currentHp + healed);

  const patch: Partial<CharacterState> = {
    hit_dice_spent: {
      ...spentMap,
      [classSlug]: (spentMap[classSlug] ?? 0) + 1,
    },
    current_hp: newHp,
  };

  if (currentHp === 0 && newHp > 0) {
    patch.death_saves = { successes: 0, failures: 0 };
  }

  return patch;
}

/** "path-of-the-berserker" → "Path Of The Berserker"; "fighter" → "Fighter". */
export function formatClassSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}
