/**
 * Dice roller — pure given an injectable RNG.
 *
 * `executeRoll` parses the request's expression, applies advantage/disadvantage
 * (rewriting the leading `1d20` term to `2d20kh1`/`2d20kl1`) and crit doubling
 * (dice counts only, never flat modifiers), rolls every dice group, and returns
 * the fully-broken-down RollResult every consumer (toast, log, DB) uses.
 *
 * Randomness never enters character state directly — results are applied via
 * explicit user actions (design §1).
 */

import { parseDiceExpression } from "./parser";
import type {
  DiceTermNode,
  ExpressionTerm,
  KeepSpec,
  Rng,
  RollGroup,
  RollRequest,
  RollResult,
} from "./types";

export function executeRoll(
  request: RollRequest,
  rng: Rng = Math.random,
): RollResult {
  const parsed = parseDiceExpression(request.expression);

  // Work on a copy — mode/crit rewrites must not mutate parser output.
  const terms: ExpressionTerm[] = parsed.terms.map((t) => ({ ...t }));

  // Advantage/disadvantage: rewrite the leading plain 1d20 term.
  if (request.mode === "advantage" || request.mode === "disadvantage") {
    const lead = terms.find(
      (t): t is DiceTermNode =>
        t.type === "dice" && t.sides === 20 && t.count === 1 && !t.keep,
    );
    if (lead) {
      lead.count = 2;
      lead.keep = {
        mode: request.mode === "advantage" ? "highest" : "lowest",
        count: 1,
      };
    }
  }

  // Crit: double the dice count of every dice term. Flat modifiers untouched.
  if (request.crit) {
    for (const t of terms) {
      if (t.type === "dice") t.count *= 2;
    }
  }

  const groups: RollGroup[] = [];
  let modifier = 0;
  let diceTotal = 0;

  for (const term of terms) {
    if (term.type === "modifier") {
      modifier += term.sign * term.value;
      continue;
    }
    const rolls: number[] = [];
    for (let i = 0; i < term.count; i++) {
      rolls.push(rollDie(term.sides, rng));
    }
    const kept = applyKeep(rolls, term.keep);
    diceTotal += term.sign * kept.reduce((sum, face) => sum + face, 0);
    groups.push({ sides: term.sides, rolls, kept });
  }

  const result: RollResult = {
    request,
    groups,
    modifier,
    total: diceTotal + modifier,
    rolled_at: new Date().toISOString(),
  };

  // Natural: the kept d20 face of the leading d20 group (crit/fumble detection).
  const leadGroup = groups[0];
  if (leadGroup && leadGroup.sides === 20 && leadGroup.kept.length === 1) {
    result.natural = leadGroup.kept[0];
  }

  return result;
}

/** Rolls one die: uniform integer in [1, sides]. */
function rollDie(sides: number, rng: Rng): number {
  // rng() contract is [0, 1); clamp defensively against a sloppy injected rng.
  const face = Math.floor(rng() * sides) + 1;
  return Math.min(Math.max(face, 1), sides);
}

/** Applies a keep-highest/keep-lowest spec, preserving roll order in the kept
 *  subset (ties broken by roll order, earliest first). */
function applyKeep(rolls: number[], keep: KeepSpec | undefined): number[] {
  if (!keep) return [...rolls];
  const ranked = rolls
    .map((face, index) => ({ face, index }))
    .sort((a, b) =>
      keep.mode === "highest"
        ? b.face - a.face || a.index - b.index
        : a.face - b.face || a.index - b.index,
    );
  const keptIndexes = ranked
    .slice(0, keep.count)
    .map((entry) => entry.index)
    .sort((a, b) => a - b);
  return keptIndexes.map((i) => rolls[i]);
}
