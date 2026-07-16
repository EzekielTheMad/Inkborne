/**
 * Dice engine types — pure, dependency-free.
 *
 * The dice module has no React, Supabase, or 5e-specific imports. It parses
 * and evaluates dice-expression strings (the same strings content data
 * carries in `data.damage.dice_at_slot_level`, weapon `damage`, hit dice…),
 * which is exactly what homebrew content will feed it in M4.
 *
 * Design: docs/specs/2026-07-15-m3-gameplay-foundations-design.md §3.
 */

/** What a roll represents — drives log badges and downstream automation. */
export type RollKind =
  | "check"
  | "save"
  | "attack"
  | "damage"
  | "heal"
  | "death_save"
  | "initiative"
  | "hit_die"
  | "concentration"
  | "custom";

/** All roll kinds, in display order. Mirrors the `character_rolls.kind` CHECK constraint. */
export const ROLL_KINDS: readonly RollKind[] = [
  "check",
  "save",
  "attack",
  "damage",
  "heal",
  "death_save",
  "initiative",
  "hit_die",
  "concentration",
  "custom",
];

/** Advantage/disadvantage. Sugar for rewriting a leading `1d20` to `2d20kh1`/`2d20kl1`. */
export type RollMode = "normal" | "advantage" | "disadvantage";

/** Keep-highest / keep-lowest suffix on a dice term (`4d6kh3`, `2d20kl1`). */
export interface KeepSpec {
  mode: "highest" | "lowest";
  count: number;
}

/** One `NdM[khX|klX]` term of an expression. `sign` comes from the `+`/`-` separator. */
export interface DiceTermNode {
  type: "dice";
  sign: 1 | -1;
  count: number;
  sides: number;
  keep?: KeepSpec;
}

/** A flat integer modifier term. `sign` comes from the `+`/`-` separator. */
export interface ModifierTermNode {
  type: "modifier";
  sign: 1 | -1;
  value: number;
}

export type ExpressionTerm = DiceTermNode | ModifierTermNode;

/** Parsed dice expression: an ordered list of signed terms. */
export interface DiceExpression {
  terms: ExpressionTerm[];
}

/** Thrown for any malformed dice string. Content validation (M4 importer) can
 *  reuse the parser to reject bad dice strings at the boundary. */
export class DiceParseError extends Error {
  readonly expression: string;

  constructor(message: string, expression: string) {
    super(`${message} (in "${expression}")`);
    this.name = "DiceParseError";
    this.expression = expression;
  }
}

/** Injectable random source: returns a float in [0, 1). Defaults to Math.random. */
export type Rng = () => number;

export interface RollRequest {
  kind: RollKind;
  /** Display label, e.g. "Athletics Check", "Fire Bolt — Damage". */
  label: string;
  /** Dice expression, e.g. "1d20+5", "2d6+3". */
  expression: string;
  /** d20-kind rolls only; implemented as 2d20kh1 / 2d20kl1. */
  mode?: RollMode;
  /** Damage rolls: double the dice (not the modifier). */
  crit?: boolean;
  /** Free-form context, e.g. { spell_slug, slot_level, dc }. */
  meta?: Record<string, unknown>;
}

/** One evaluated dice group: every face rolled, and the subset that counted. */
export interface RollGroup {
  sides: number;
  rolls: number[];
  kept: number[];
}

export interface RollResult {
  request: RollRequest;
  groups: RollGroup[];
  /** Sum of all flat integer terms (signed). */
  modifier: number;
  total: number;
  /** The kept d20 face for d20-kind rolls (crit/fumble detection). */
  natural?: number;
  /** ISO timestamp of when the roll executed. */
  rolled_at: string;
}
