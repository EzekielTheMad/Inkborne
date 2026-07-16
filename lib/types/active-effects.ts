import type { Effect } from "./effects";

/**
 * Structured duration for an active effect (design §6.2).
 *
 * Durations are advisory, not authoritative — there is no combat tracker in
 * M3, so wall-clock time is only trusted for long real-time durations:
 *
 * - `hours` — true real-time kinds (Mage Armor's 8 hours). These get an
 *   `expires_at` timestamp and count down on the sheet.
 * - `minutes` / `rounds` — combat/scene-scale. Wall-clock time is meaningless
 *   mid-encounter (a real hour of table talk is often zero in-game seconds),
 *   so these display their denomination statically and never auto-expire.
 * - `until_rest` — cleared by any rest.
 * - `instantaneous` — never becomes an ActiveEffect.
 * - `special` — "until dispelled" etc.; manual removal only.
 */
export type EffectDuration =
  | { type: "rounds"; value: number }
  | { type: "minutes"; value: number }
  | { type: "hours"; value: number }
  | { type: "until_rest" }
  | { type: "instantaneous" }
  | { type: "special" };

export type ActiveEffectSource = "spell" | "feature" | "item" | "custom";

/**
 * A runtime instance of a piece of content's `Effect[]` payload, pinned to
 * the character with duration metadata. Lives in `character.state.active_effects`
 * (JSONB) and mutates only through `patch_character_state` via the pure
 * helpers in `lib/active-effects/helpers.ts`.
 *
 * The `effects` array is a SNAPSHOT of the content's effects at apply time —
 * evaluation never re-resolves from `content_id` (no async fetch in the
 * render path; live content edits don't mutate in-flight buffs; custom
 * entries need no content row at all).
 */
export interface ActiveEffect {
  /** uuid (client-generated) — removal handle. */
  id: string;
  /** Denormalized display name, e.g. "Mage Armor". */
  name: string;
  /** Content slug, or "custom". */
  slug: string;
  source: ActiveEffectSource;
  /** Provenance link; null for custom entries. */
  content_id: string | null;
  /** Snapshot of the content's effects[] at apply time. */
  effects: Effect[];
  duration: EffectDuration;
  /** Linked to state.concentrating_on — dropping concentration removes all linked entries. */
  concentration: boolean;
  /** Slot level the source spell was cast at (upcast awareness). */
  cast_at_level?: number;
  /** ISO timestamp of application. */
  applied_at: string;
  /** applied_at + duration for real-time kinds (hours); null otherwise. */
  expires_at: string | null;
}

/**
 * Input for the widget's "+ Add effect" custom escape hatch: cover bonuses,
 * potion buffs, DM rulings — representable without a content row.
 */
export interface CustomEffectInput {
  name: string;
  /** Optional flat stat modifier, e.g. { stat: "armor_class", value: 2 }. */
  stat?: string;
  value?: number;
  duration: EffectDuration;
}

/** Additive roll-modifier hint appended to matching roll expressions (design §6.4). */
export interface RollModifier {
  /** Effect name for the roll breakdown, e.g. "Bless" in `1d20+5 +1d4 (Bless)`. */
  name: string;
  /** Dice string (may be negative, e.g. "-1d4" for Bane). */
  dice: string;
}

/**
 * Conventional `MechanicalEffect.stat` targets consumed by the roll layer,
 * not the evaluator (which ignores unknown stat slugs by design).
 */
export const ROLL_MODIFIER_STATS = {
  attack: "roll_attack",
  save: "roll_save",
  check: "roll_check",
} as const;

export type RollModifierKind = keyof typeof ROLL_MODIFIER_STATS;
