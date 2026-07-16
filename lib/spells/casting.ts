import type { CharacterState } from "@/lib/types/character";
import type { Effect } from "@/lib/types/effects";
import type { ActiveEffect } from "@/lib/types/active-effects";
import type {
  CasterInfo,
  CharacterSpell,
  MaxSlotsByLevel,
  SpellSlotsUsed,
} from "@/lib/types/spells";
import type { RollRequest } from "@/lib/dice/types";
import {
  applyActiveEffectPatch,
  buildActiveEffectFromSpell,
  type BuildActiveEffectOptions,
} from "@/lib/active-effects/helpers";
import { parseSpellDuration } from "@/lib/spells/duration";

// ---------------------------------------------------------------------------
// Spell casting — pure domain helpers (design §4, T5).
//
// Everything here derives from the spell's schema-validated `data`
// (spellDataSchema) — no per-spell logic. A homebrew spell with a valid
// `data` payload and an `effects[]` array gets the cast dialog, dice rolls,
// and duration tracking for free.
//
// State mutation happens only where callers apply the returned `statePatch`
// via `patchState` (→ patch_character_state RPC) — ONE atomic write per cast
// composing slot consumption + concentration + active effects (decision D6).
// ---------------------------------------------------------------------------

/** How the caster pays for the cast. */
export type CastChoice =
  | { type: "cantrip" }
  | { type: "slot"; level: number }
  | { type: "pact"; level: number }
  | { type: "ritual" };

/** The slice of spell content the cast computation needs. Snapshot-compatible
 *  with `SpellEffectSource` (lib/active-effects/helpers.ts). */
export interface CastSpellSource {
  id?: string | null;
  name: string;
  slug: string;
  effects?: Effect[] | null;
  data: CastSpellData;
}

/** Loosely-typed view of `spellDataSchema` — content rows are JSONB. */
export interface CastSpellData {
  level?: number;
  school?: string;
  casting_time?: string;
  range?: string;
  components?: string[];
  duration?: string;
  duration_structured?: ActiveEffect["duration"];
  concentration?: boolean;
  ritual?: boolean;
  /** "melee" | "ranged" when the spell makes a spell attack (migration 00040). */
  attack_type?: "melee" | "ranged" | null;
  damage?: {
    type?: string | null;
    /** Leveled spells: keyed by slot level. Cantrips: keyed by CHARACTER
     *  level tiers (1/5/11/17) — dnd5eapi's damage_at_character_level. */
    dice_at_slot_level?: Record<string, string>;
  } | null;
  heal_at_slot_level?: Record<string, string> | null;
  dc?: { type?: string; success?: "half" | "none" | "other" } | null;
  descriptionCantripDie?: { die: string; levels?: number[] };
}

/** Whether (and how) a spell row can be cast right now. */
export type SpellCastability = "full" | "ritual-only" | "none";

export interface SlotOption {
  /** `spell_slots_used` key: "1"–"9" or "pact". */
  key: keyof SpellSlotsUsed;
  /** Effective cast level (pact options carry the pact slot level). */
  castLevel: number;
  total: number;
  used: number;
  free: number;
  isPact: boolean;
}

export interface CastDcInfo {
  ability: string;
  dc: number;
  success: "half" | "none" | "other";
}

export interface CastComputationInput {
  spell: CastSpellSource;
  choice: CastChoice;
  state: CharacterState;
  casterInfo: CasterInfo;
  /** Evaluated ability scores (evalResult.stats) — for `MOD` substitution. */
  abilityScores: Record<string, number>;
  /** Total character level — cantrip tier scaling (5/11/17). */
  characterLevel: number;
  /** The class the spell was learned under (MOD uses its casting ability). */
  classSlug?: string;
  /** Injectable clock / id generator (tests). */
  now?: Date;
  generateId?: BuildActiveEffectOptions["generateId"];
}

export interface CastOutcome {
  /** Apply in ONE patchState call: slots + concentration + active effects. */
  statePatch: Partial<CharacterState>;
  /** Rolls the result pane offers (attack / damage / heal). */
  rollRequests: RollRequest[];
  /** The ActiveEffect entry the patch applies, when the duration warrants one. */
  activeEffect: ActiveEffect | null;
  /** Effective slot level of the cast (0 for cantrips). */
  castLevel: number;
  /** Save-DC display info (the TARGET rolls saves, so this is informational). */
  dcInfo: CastDcInfo | null;
}

// ---------------------------------------------------------------------------
// Dice-map resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a `dice_at_slot_level` / `heal_at_slot_level` map at `level` using
 * breakpoint inheritance: levels between defined keys inherit the highest
 * defined key ≤ the requested level (SRD data lists only breakpoints).
 * Returns null when no key qualifies (e.g. below the spell's base level).
 */
export function resolveAtSlotLevel(
  map: Record<string, string> | null | undefined,
  level: number,
): string | null {
  if (!map) return null;
  let bestKey = -1;
  for (const key of Object.keys(map)) {
    const n = Number.parseInt(key, 10);
    if (!Number.isNaN(n) && n <= level && n > bestKey) bestKey = n;
  }
  return bestKey >= 0 ? map[String(bestKey)] : null;
}

/**
 * Substitute the SRD `MOD` placeholder (spellcasting ability modifier) into a
 * dice string and normalize the sign so the parser accepts it:
 * `"1d8 + MOD"` with mod 3 → `"1d8 + 3"`; with mod -2 → `"1d8 - 2"`.
 */
export function substituteMod(expression: string, mod: number): string {
  if (!/mod/i.test(expression)) return expression;
  const substituted = expression.replace(/MOD/gi, String(mod));
  // "+ -2" → "- 2", "- -2" → "+ 2"
  return substituted
    .replace(/\+\s*-\s*/g, "- ")
    .replace(/-\s*-\s*/g, "+ ");
}

/**
 * Cantrip damage from `descriptionCantripDie` (die grows by one step per tier
 * reached: levels [1,5,11,17] → "1d8" becomes "3d8" at character level 11).
 * Fallback for enriched content without a per-character-level damage map.
 */
export function resolveCantripDie(
  cantripDie: { die: string; levels?: number[] } | undefined,
  characterLevel: number,
): string | null {
  if (!cantripDie?.die) return null;
  const match = cantripDie.die.trim().match(/^(\d*)d(\d+)$/i);
  if (!match) return null;
  const baseCount = match[1] ? Number.parseInt(match[1], 10) : 1;
  const sides = match[2];
  const tiers = (cantripDie.levels ?? [1, 5, 11, 17]).filter(
    (l) => l <= characterLevel,
  ).length;
  const multiplier = Math.max(1, tiers);
  return `${baseCount * multiplier}d${sides}`;
}

// ---------------------------------------------------------------------------
// Castability + slot options
// ---------------------------------------------------------------------------

/** Extract a `CastSpellSource` from a character_spells row (null when the row
 *  has no content definition to cast from). */
export function castSourceFromCharacterSpell(
  spell: CharacterSpell,
): CastSpellSource | null {
  const content = spell.content_definitions;
  if (!content || typeof content.data?.level !== "number") return null;
  return {
    id: content.id,
    name: content.name,
    slug: content.slug,
    effects: (content.effects ?? []) as unknown as Effect[],
    data: content.data as CastSpellData,
  };
}

/**
 * Whether a spell row is castable, and via which path:
 * - cantrips and always-prepared spells: always castable
 * - prepared-caster spells: castable when prepared
 * - known-caster spells: castable when known
 * - wizard RAW nuance: an unprepared ritual spell that is `in_spellbook` can
 *   be ritual-cast (and ONLY ritual-cast) when the class has ritual casting.
 */
export function getSpellCastability(
  spell: CharacterSpell,
  casterInfo: CasterInfo,
): SpellCastability {
  const data = spell.content_definitions?.data as CastSpellData | undefined;
  if (!data || typeof data.level !== "number") return "none";
  if (data.level === 0) return "full";
  if (spell.always_prepared) return "full";

  const casterClass = casterInfo.classes.find((c) => c.slug === spell.class_slug);
  const requiresPreparation = casterClass?.prepared ?? false;
  const castable = requiresPreparation ? spell.is_prepared : spell.is_known;
  if (castable) return "full";

  if (data.ritual === true && spell.in_spellbook && casterClass?.ritualCasting) {
    return "ritual-only";
  }
  return "none";
}

/** Whether the ritual path is legal for this spell (independent of slots). */
export function isRitualEligible(
  spell: CharacterSpell,
  casterInfo: CasterInfo,
): boolean {
  const data = spell.content_definitions?.data as CastSpellData | undefined;
  if (data?.ritual !== true) return false;
  const casterClass = casterInfo.classes.find((c) => c.slug === spell.class_slug);
  return casterClass?.ritualCasting ?? false;
}

const LEVELED_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Slot options for casting a spell of `spellLevel`: every leveled slot at or
 * above the spell's level that the character HAS (free or not — exhausted
 * options render disabled), plus the pact option when the pact slot level
 * qualifies (Warlock pact slots are first-class, decision D6). Ordered by
 * effective cast level, leveled before pact on ties.
 */
export function getEligibleSlotOptions(
  spellLevel: number,
  maxSlots: MaxSlotsByLevel,
  slotState: SpellSlotsUsed,
  pactSlotLevel: number | null,
): SlotOption[] {
  const options: SlotOption[] = [];
  for (const key of LEVELED_KEYS) {
    const total = maxSlots[key] ?? 0;
    const level = Number.parseInt(key, 10);
    if (total <= 0 || level < spellLevel) continue;
    const used = Math.min(slotState[key] ?? 0, total);
    options.push({ key, castLevel: level, total, used, free: total - used, isPact: false });
  }
  const pactTotal = maxSlots.pact ?? 0;
  if (pactTotal > 0 && pactSlotLevel !== null && pactSlotLevel >= spellLevel) {
    const used = Math.min(slotState.pact ?? 0, pactTotal);
    options.push({
      key: "pact",
      castLevel: pactSlotLevel,
      total: pactTotal,
      used,
      free: pactTotal - used,
      isPact: true,
    });
  }
  options.sort(
    (a, b) => a.castLevel - b.castLevel || Number(a.isPact) - Number(b.isPact),
  );
  return options;
}

/** Default pick: the lowest-cast-level option with a free slot (leveled
 *  preferred over pact on ties, matching the display order). */
export function getDefaultSlotOption(options: SlotOption[]): SlotOption | null {
  return options.find((o) => o.free > 0) ?? null;
}

// ---------------------------------------------------------------------------
// The cast computation
// ---------------------------------------------------------------------------

function abilityModFor(
  casterInfo: CasterInfo,
  abilityScores: Record<string, number>,
  classSlug: string | undefined,
): number {
  const mod = (ability: string) =>
    Math.floor(((abilityScores[ability] ?? 10) - 10) / 2);
  const casterClass = classSlug
    ? casterInfo.classes.find((c) => c.slug === classSlug)
    : undefined;
  if (casterClass) return mod(casterClass.ability);
  // Fallback (feature-granted spells etc.): best mod across caster classes.
  let best = 0;
  for (const c of casterInfo.classes) best = Math.max(best, mod(c.ability));
  return best;
}

function formatBonus(bonus: number): string {
  return bonus >= 0 ? `+${bonus}` : `${bonus}`;
}

/**
 * Compute everything a cast does: the single atomic state patch (slot
 * consumption + concentration + active effects via the T6 helpers) and the
 * roll requests the result pane offers. Pure — unit-testable with zero
 * mocking, mirroring `computeShortRestEffects`.
 */
export function computeCastEffects(input: CastComputationInput): CastOutcome {
  const {
    spell,
    choice,
    state,
    casterInfo,
    abilityScores,
    characterLevel,
    classSlug,
    now,
    generateId,
  } = input;
  const data = spell.data;
  const spellLevel = data.level ?? 0;

  // --- Effective cast level ---
  const castLevel =
    choice.type === "cantrip"
      ? 0
      : choice.type === "ritual"
        ? spellLevel
        : choice.level;

  const statePatch: Partial<CharacterState> = {};

  // --- Slot consumption (cantrips and rituals consume nothing) ---
  if (choice.type === "slot" || choice.type === "pact") {
    const key = (choice.type === "pact" ? "pact" : String(choice.level)) as
      keyof SpellSlotsUsed;
    const slots = (state.spell_slots_used ?? {}) as SpellSlotsUsed;
    statePatch.spell_slots_used = { ...slots, [key]: (slots[key] ?? 0) + 1 };
  }

  // --- Active effect + concentration (one atomic patch, decision D6) ---
  const duration =
    data.duration_structured ?? parseSpellDuration(data.duration ?? "");
  let activeEffect: ActiveEffect | null = null;
  if (duration.type !== "instantaneous") {
    activeEffect = buildActiveEffectFromSpell(
      spell,
      castLevel,
      { now, generateId },
    );
    // For concentration spells this strips previous linked effects and sets
    // concentrating_on in the same patch object.
    Object.assign(statePatch, applyActiveEffectPatch(state, activeEffect));
  }

  // --- Roll requests ---
  const rollRequests: RollRequest[] = [];
  const mod = abilityModFor(casterInfo, abilityScores, classSlug);
  const meta = { spell_slug: spell.slug, slot_level: castLevel };

  if (data.attack_type === "melee" || data.attack_type === "ranged") {
    rollRequests.push({
      kind: "attack",
      label: `${spell.name} — Attack`,
      expression: `1d20${formatBonus(casterInfo.spellAttackBonus)}`,
      meta,
    });
  }

  const damageLookupLevel = spellLevel === 0 ? characterLevel : castLevel;
  let damageDice = resolveAtSlotLevel(
    data.damage?.dice_at_slot_level,
    damageLookupLevel,
  );
  if (!damageDice && spellLevel === 0) {
    damageDice = resolveCantripDie(data.descriptionCantripDie, characterLevel);
  }
  if (damageDice) {
    rollRequests.push({
      kind: "damage",
      label: `${spell.name} — Damage`,
      expression: substituteMod(damageDice, mod),
      meta: { ...meta, damage_type: data.damage?.type ?? undefined },
    });
  }

  const healDice = resolveAtSlotLevel(data.heal_at_slot_level, castLevel);
  if (healDice) {
    rollRequests.push({
      kind: "heal",
      label: `${spell.name} — Healing`,
      expression: substituteMod(healDice, mod),
      meta,
    });
  }

  const dcInfo: CastDcInfo | null = data.dc?.type
    ? {
        ability: data.dc.type,
        dc: casterInfo.spellDc,
        success: data.dc.success ?? "other",
      }
    : null;

  return { statePatch, rollRequests, activeEffect, castLevel, dcInfo };
}
