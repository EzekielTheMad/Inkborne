import type { CharacterState } from "@/lib/types/character";
import type { Effect, MechanicalEffect } from "@/lib/types/effects";
import type {
  ActiveEffect,
  CustomEffectInput,
  EffectDuration,
  RollModifier,
  RollModifierKind,
} from "@/lib/types/active-effects";
import { ROLL_MODIFIER_STATS } from "@/lib/types/active-effects";
import { parseSpellDuration } from "@/lib/spells/duration";
import type { RollKind, RollRequest } from "@/lib/dice/types";

// ---------------------------------------------------------------------------
// All helpers here are PURE: they compute next values from current ones and
// never touch React, Supabase, or the wall clock except through the injectable
// `now` parameter. State mutations happen only where callers apply the
// returned patches via `patchState` (→ patch_character_state RPC).
// ---------------------------------------------------------------------------

/** Minimal spell-content shape needed to build an ActiveEffect snapshot. */
export interface SpellEffectSource {
  id?: string | null;
  name: string;
  slug: string;
  effects?: Effect[] | null;
  data: {
    duration?: string;
    duration_structured?: EffectDuration;
    concentration?: boolean;
  };
}

export interface BuildActiveEffectOptions {
  /** Injectable clock (tests); defaults to `new Date()`. */
  now?: Date;
  /** Injectable id generator (tests); defaults to `crypto.randomUUID()`. */
  generateId?: () => string;
}

function defaultId(): string {
  return crypto.randomUUID();
}

/**
 * Compute `expires_at` for a duration applied at `appliedAt`.
 *
 * Only `hours` durations are treated as real-time (Mage Armor's 8 hours):
 * rounds/minutes are combat-scale, where wall-clock time is meaningless
 * (a real hour of table talk is often zero in-game seconds), so they never
 * hard-expire — they display their denomination and are cleared by rests or
 * one-tap dismissal.
 */
export function computeExpiresAt(
  duration: EffectDuration,
  appliedAt: Date,
): string | null {
  if (duration.type === "hours") {
    return new Date(
      appliedAt.getTime() + duration.value * 60 * 60 * 1000,
    ).toISOString();
  }
  return null;
}

/** True when a real-time effect's `expires_at` has passed. */
export function isExpired(effect: ActiveEffect, now: Date = new Date()): boolean {
  if (!effect.expires_at) return false;
  return now.getTime() >= new Date(effect.expires_at).getTime();
}

/**
 * Human display for an effect's remaining duration:
 * - hours kind: live countdown ("7h 52m", "23m", "expired")
 * - minutes kind: static denomination ("1 min (10 rounds)")
 * - rounds kind: static denomination ("3 rounds")
 * - until_rest: "until rest" · special: "until removed"
 */
export function formatRemaining(
  effect: ActiveEffect,
  now: Date = new Date(),
): string {
  const d = effect.duration;
  switch (d.type) {
    case "rounds":
      return d.value === 1 ? "1 round" : `${d.value} rounds`;
    case "minutes":
      return `${d.value} min (${d.value * 10} rounds)`;
    case "hours": {
      if (!effect.expires_at) return `${d.value}h`;
      const msLeft = new Date(effect.expires_at).getTime() - now.getTime();
      if (msLeft <= 0) return "expired";
      const totalMinutes = Math.ceil(msLeft / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    case "until_rest":
      return "until rest";
    case "instantaneous":
      return "";
    case "special":
      return "until removed";
  }
}

// ---------------------------------------------------------------------------
// Array mutations (immutable)
// ---------------------------------------------------------------------------

/** Append an entry, returning a new array. */
export function addActiveEffect(
  current: ActiveEffect[],
  entry: ActiveEffect,
): ActiveEffect[] {
  return [...current, entry];
}

/** Remove the entry with `id`, returning a new array. */
export function removeActiveEffect(
  current: ActiveEffect[],
  id: string,
): ActiveEffect[] {
  return current.filter((e) => e.id !== id);
}

/** Strip every concentration-linked entry (used when concentration drops or is replaced). */
export function dropConcentrationEffects(
  current: ActiveEffect[],
): ActiveEffect[] {
  return current.filter((e) => !e.concentration);
}

/**
 * Flatten non-expired active effects into the `Effect[]` the evaluator
 * consumes. Expired entries stop contributing (their visual lingers on the
 * widget so the player understands why a stat just dropped), but stay in
 * state until dismissed.
 */
export function collectActiveEffects(
  current: ActiveEffect[] | undefined,
  now: Date = new Date(),
): Effect[] {
  if (!current || current.length === 0) return [];
  return current.filter((e) => !isExpired(e, now)).flatMap((e) => e.effects);
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build an ActiveEffect snapshot from spell content at cast/apply time.
 * Prefers the pre-parsed `duration_structured`; falls back to parsing the
 * SRD duration string. Snapshots `effects[]` so live content edits never
 * mutate an in-flight buff.
 */
export function buildActiveEffectFromSpell(
  spell: SpellEffectSource,
  castAtLevel?: number,
  options: BuildActiveEffectOptions = {},
): ActiveEffect {
  const now = options.now ?? new Date();
  const generateId = options.generateId ?? defaultId;
  const duration =
    spell.data.duration_structured ??
    parseSpellDuration(spell.data.duration ?? "");

  return {
    id: generateId(),
    name: spell.name,
    slug: spell.slug,
    source: "spell",
    content_id: spell.id ?? null,
    effects: [...(spell.effects ?? [])],
    duration,
    concentration: spell.data.concentration === true,
    ...(castAtLevel !== undefined ? { cast_at_level: castAtLevel } : {}),
    applied_at: now.toISOString(),
    expires_at: computeExpiresAt(duration, now),
  };
}

/**
 * Build an ActiveEffect from the widget's custom-entry escape hatch
 * (cover bonuses, potion buffs, DM rulings). A flat stat modifier becomes a
 * single mechanical `add` effect; omit it for display-only entries.
 */
export function buildCustomActiveEffect(
  input: CustomEffectInput,
  options: BuildActiveEffectOptions = {},
): ActiveEffect {
  const now = options.now ?? new Date();
  const generateId = options.generateId ?? defaultId;
  const effects: Effect[] =
    input.stat && input.value !== undefined && input.value !== 0
      ? [{ type: "mechanical", stat: input.stat, op: "add", value: input.value }]
      : [];

  return {
    id: generateId(),
    name: input.name,
    slug: "custom",
    source: "custom",
    content_id: null,
    effects,
    duration: input.duration,
    concentration: false,
    applied_at: now.toISOString(),
    expires_at: computeExpiresAt(input.duration, now),
  };
}

// ---------------------------------------------------------------------------
// State-patch composition (the API T5's cast dialog and T7's concentration
// lifecycle consume — each result is applied in ONE patchState call)
// ---------------------------------------------------------------------------

function currentEffects(state: CharacterState): ActiveEffect[] {
  return (state.active_effects ?? []) as ActiveEffect[];
}

/**
 * Patch for applying an ActiveEffect. When the entry is concentration-linked,
 * the same atomic patch replaces `concentrating_on` and strips the previous
 * concentration's effects — no window where state disagrees with itself.
 *
 * `concentrating_on` metadata (spell_slug/slot_level) derives from the entry;
 * T5's cast dialog composes this patch with slot consumption before applying.
 */
export function applyActiveEffectPatch(
  state: CharacterState,
  entry: ActiveEffect,
): Partial<CharacterState> {
  if (!entry.concentration) {
    return { active_effects: addActiveEffect(currentEffects(state), entry) };
  }
  return {
    active_effects: addActiveEffect(
      dropConcentrationEffects(currentEffects(state)),
      entry,
    ),
    concentrating_on: {
      spell_slug: entry.slug,
      spell_name: entry.name,
      slot_level: entry.cast_at_level ?? 0,
      started_at: entry.applied_at,
    },
  };
}

/**
 * Patch for removing one entry by id. If the removed entry was the last
 * concentration-linked one, `concentrating_on` clears in the same patch
 * (full concentration lifecycle — damage prompts etc. — lands in T7).
 */
export function removeActiveEffectPatch(
  state: CharacterState,
  id: string,
): Partial<CharacterState> {
  const current = currentEffects(state);
  const removed = current.find((e) => e.id === id);
  const next = removeActiveEffect(current, id);
  const patch: Partial<CharacterState> = { active_effects: next };

  if (removed?.concentration && !next.some((e) => e.concentration)) {
    patch.concentrating_on = null;
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Roll-modifier scan (consumed by useRolls in T2/T3)
// ---------------------------------------------------------------------------

/**
 * Scan non-expired active effects for roll-modifier hints — mechanical
 * effects targeting the conventional `roll_attack` / `roll_save` /
 * `roll_check` stats with a dice-string value (design §6.4). The roll layer
 * appends each to matching RollRequest expressions with the effect name in
 * the breakdown (`1d20+5 +1d4 (Bless)`). The evaluator ignores these stat
 * slugs by design.
 */
export function collectRollModifiers(
  current: ActiveEffect[] | undefined,
  kind: RollModifierKind,
  now: Date = new Date(),
): RollModifier[] {
  if (!current || current.length === 0) return [];
  const targetStat = ROLL_MODIFIER_STATS[kind];
  const modifiers: RollModifier[] = [];
  for (const entry of current) {
    if (isExpired(entry, now)) continue;
    for (const effect of entry.effects) {
      if (
        effect.type === "mechanical" &&
        (effect as MechanicalEffect).stat === targetStat &&
        typeof (effect as MechanicalEffect).value === "string"
      ) {
        modifiers.push({
          name: entry.name,
          dice: (effect as MechanicalEffect).value as string,
        });
      }
    }
  }
  return modifiers;
}

/**
 * Which roll kinds accept which roll-modifier hints. Kinds absent here
 * (damage, heal, hit_die, death_save†, custom) are never modified.
 *
 * † Death saves are not "saving throws using an ability score" — Bless does
 *   not apply to them RAW, so they stay unmapped.
 */
const ROLL_KIND_TO_MODIFIER_KIND: Partial<Record<RollKind, RollModifierKind>> = {
  attack: "attack",
  save: "save",
  concentration: "save", // a concentration check IS a CON saving throw
  check: "check",
  initiative: "check", // initiative is a Dexterity check RAW
};

/**
 * Append active-effect roll modifiers (Bless's `+1d4`, Bane's `-1d4`…) to a
 * matching RollRequest before execution (design §6.4). The expression gains
 * the dice terms, the label names each source for the breakdown
 * (`Attack · +1d4 (Bless)`), and `meta.roll_modifiers` records provenance.
 * Non-matching kinds and empty scans return the request untouched.
 */
export function applyRollModifiers(
  request: RollRequest,
  current: ActiveEffect[] | undefined,
  now: Date = new Date(),
): RollRequest {
  const modifierKind = ROLL_KIND_TO_MODIFIER_KIND[request.kind];
  if (!modifierKind) return request;

  const modifiers = collectRollModifiers(current, modifierKind, now);
  if (modifiers.length === 0) return request;

  const signed = modifiers.map((m) => {
    const dice = m.dice.trim();
    return dice.startsWith("-") || dice.startsWith("+") ? dice : `+${dice}`;
  });
  return {
    ...request,
    expression: `${request.expression}${signed.join("")}`,
    label: `${request.label} · ${modifiers
      .map((m, i) => `${signed[i]} (${m.name})`)
      .join(" ")}`,
    meta: { ...request.meta, roll_modifiers: modifiers },
  };
}
