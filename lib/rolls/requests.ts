import type { RollKind, RollMode, RollRequest } from "@/lib/dice/types";
import type { RollModifier, RollModifierKind } from "@/lib/types/active-effects";

// ---------------------------------------------------------------------------
// Pure RollRequest builders for the sheet's roll surfaces (M3 T3, design §3.4).
//
// Every clickable modifier on the sheet funnels through these helpers so the
// expression grammar stays in one place: a d20 kind builds `1d20±mod` plus any
// active-effect roll-modifier dice (Bless's `+1d4`, Bane's `-1d4`…), while
// immediate kinds (damage/heal/hit dice) pass their expression through with
// optional crit arming. No React, no randomness — unit-testable end to end.
// ---------------------------------------------------------------------------

/** Roll kinds resolved by a d20 — these get the Normal/Advantage/Disadvantage
 *  popover; everything else rolls immediately on click (design D1). */
export const D20_ROLL_KINDS: readonly RollKind[] = [
  "check",
  "save",
  "attack",
  "initiative",
  "death_save",
  "concentration",
];

export function isD20RollKind(kind: RollKind): boolean {
  return D20_ROLL_KINDS.includes(kind);
}

/**
 * Which active-effect roll-modifier bucket applies to a d20 roll kind
 * (design §6.4: `roll_attack` / `roll_save` / `roll_check`).
 *
 * RAW mapping: a death save IS a saving throw (Bless applies), initiative IS
 * a Dexterity check (Guidance applies), and a concentration check IS a CON
 * save — so each inherits the matching bucket.
 */
export function rollModifierKindFor(kind: RollKind): RollModifierKind {
  switch (kind) {
    case "attack":
      return "attack";
    case "save":
    case "death_save":
    case "concentration":
      return "save";
    default:
      return "check";
  }
}

/** "+3", "-1" — empty string for 0 (a bare `1d20` reads cleaner than `1d20+0`). */
export function formatSignedTerm(modifier: number): string {
  if (modifier === 0) return "";
  return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Append roll-modifier dice to an expression. A modifier's dice string keeps
 * its own sign ("1d4" appends as "+1d4", "-1d4" appends as-is).
 */
export function appendRollModifierDice(
  expression: string,
  rollModifiers: readonly RollModifier[],
): string {
  let result = expression;
  for (const modifier of rollModifiers) {
    const dice = modifier.dice.trim();
    if (dice.length === 0) continue;
    result += dice.startsWith("-") || dice.startsWith("+") ? dice : `+${dice}`;
  }
  return result;
}

export interface D20RollInput {
  kind: RollKind;
  /** Display label, e.g. "Athletics Check", "Longsword — Attack". */
  label: string;
  /** Flat bonus. Omit (or 0) for unmodified rolls like death saves. */
  modifier?: number;
  mode?: RollMode;
  /** Active-effect dice riders from `collectRollModifiers` (Bless, Bane…). */
  rollModifiers?: readonly RollModifier[];
  meta?: Record<string, unknown>;
}

/**
 * Build a d20 roll request: `1d20` ± flat modifier, plus one dice term per
 * active roll modifier. The modifiers ride along in `meta.roll_modifiers` so
 * the breakdown can attribute each appended group by name
 * (`1d20+5 +1d4 (Bless)`).
 */
export function buildD20RollRequest(input: D20RollInput): RollRequest {
  const rollModifiers = input.rollModifiers ?? [];
  const expression = appendRollModifierDice(
    `1d20${formatSignedTerm(input.modifier ?? 0)}`,
    rollModifiers,
  );

  const request: RollRequest = {
    kind: input.kind,
    label: input.label,
    expression,
  };
  if (input.mode && input.mode !== "normal") request.mode = input.mode;

  const meta: Record<string, unknown> = { ...(input.meta ?? {}) };
  if (rollModifiers.length > 0) meta.roll_modifiers = [...rollModifiers];
  if (Object.keys(meta).length > 0) request.meta = meta;

  return request;
}

export interface ImmediateRollInput {
  kind: RollKind;
  label: string;
  /** Complete dice expression, e.g. "1d8+3". */
  expression: string;
  /** Double the dice (not the modifier) — armed by a preceding nat-20 attack. */
  crit?: boolean;
  meta?: Record<string, unknown>;
}

/** Build a no-popover roll request (damage, heal, hit dice — no adv/dis). */
export function buildImmediateRollRequest(input: ImmediateRollInput): RollRequest {
  const request: RollRequest = {
    kind: input.kind,
    label: input.label,
    expression: input.expression,
  };
  if (input.crit) request.crit = true;
  if (input.meta && Object.keys(input.meta).length > 0) {
    request.meta = { ...input.meta };
  }
  return request;
}

/**
 * Human preview of a d20 roll for the popover's transparency line:
 * "1d20+5", "1d20+5 +1d4 (Bless)", "1d20 −1d4 (Bane)".
 */
export function describeD20Roll(
  modifier: number | undefined,
  rollModifiers: readonly RollModifier[] = [],
): string {
  const parts = [`1d20${formatSignedTerm(modifier ?? 0)}`];
  for (const rider of rollModifiers) {
    const dice = rider.dice.trim();
    if (dice.length === 0) continue;
    const signed = dice.startsWith("-") || dice.startsWith("+") ? dice : `+${dice}`;
    parts.push(`${signed} (${rider.name})`);
  }
  return parts.join(" ");
}
