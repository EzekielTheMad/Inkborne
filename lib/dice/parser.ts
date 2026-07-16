/**
 * Dice-expression parser.
 *
 * Grammar (design §3.2):
 *   expression := term (('+' | '-') term)*
 *   term       := dice | integer
 *   dice       := count? 'd' sides keep?
 *   keep       := ('kh' | 'kl') count
 *
 * Examples: "1d20+5", "2d6+3", "8d6", "2d20kh1+7", "4d6kl3", "d20".
 * Unknown syntax throws a typed DiceParseError.
 */

import {
  DiceParseError,
  type DiceExpression,
  type ExpressionTerm,
  type KeepSpec,
} from "./types";

/** Sanity caps — a malformed content string should fail loudly, not spin. */
const MAX_DICE_COUNT = 100;
const MAX_DIE_SIDES = 1000;

export function parseDiceExpression(input: string): DiceExpression {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new DiceParseError("Empty dice expression", input ?? "");
  }

  // Whitespace-tolerant, case-insensitive.
  const src = input.replace(/\s+/g, "").toLowerCase();
  const terms: ExpressionTerm[] = [];
  let pos = 0;

  while (pos < src.length) {
    let sign: 1 | -1 = 1;

    if (terms.length > 0) {
      const op = src[pos];
      if (op === "+") {
        sign = 1;
      } else if (op === "-") {
        sign = -1;
      } else {
        throw new DiceParseError(
          `Expected '+' or '-' before "${src.slice(pos)}"`,
          input,
        );
      }
      pos += 1;
      if (pos >= src.length) {
        throw new DiceParseError("Expression ends with an operator", input);
      }
    }

    const [term, nextPos] = parseTerm(src, pos, sign, input);
    terms.push(term);
    pos = nextPos;
  }

  return { terms };
}

function parseTerm(
  src: string,
  pos: number,
  sign: 1 | -1,
  original: string,
): [ExpressionTerm, number] {
  const [digits, afterDigits] = readDigits(src, pos);

  if (src[afterDigits] !== "d") {
    // Plain integer modifier.
    if (digits === null) {
      throw new DiceParseError(
        `Expected a dice term or number at "${src.slice(pos)}"`,
        original,
      );
    }
    return [{ type: "modifier", sign, value: digits }, afterDigits];
  }

  // Dice term: count defaults to 1 for bare "dN".
  const count = digits ?? 1;
  const [sides, afterSides] = readDigits(src, afterDigits + 1);
  if (sides === null) {
    throw new DiceParseError("Missing die size after 'd'", original);
  }
  if (count < 1) {
    throw new DiceParseError("Dice count must be at least 1", original);
  }
  if (count > MAX_DICE_COUNT) {
    throw new DiceParseError(
      `Dice count exceeds the maximum of ${MAX_DICE_COUNT}`,
      original,
    );
  }
  if (sides < 1) {
    throw new DiceParseError("Die must have at least 1 side", original);
  }
  if (sides > MAX_DIE_SIDES) {
    throw new DiceParseError(
      `Die size exceeds the maximum of ${MAX_DIE_SIDES}`,
      original,
    );
  }

  // Optional keep suffix: khN / klN.
  let keep: KeepSpec | undefined;
  let next = afterSides;
  const suffix = src.slice(next, next + 2);
  if (suffix === "kh" || suffix === "kl") {
    const [keepCount, afterKeep] = readDigits(src, next + 2);
    if (keepCount === null) {
      throw new DiceParseError(
        `Missing keep count after '${suffix}'`,
        original,
      );
    }
    if (keepCount < 1) {
      throw new DiceParseError("Keep count must be at least 1", original);
    }
    if (keepCount > count) {
      throw new DiceParseError(
        `Keep count (${keepCount}) cannot exceed dice count (${count})`,
        original,
      );
    }
    keep = {
      mode: suffix === "kh" ? "highest" : "lowest",
      count: keepCount,
    };
    next = afterKeep;
  }

  return [{ type: "dice", sign, count, sides, keep }, next];
}

/** Reads a run of digits at `pos`. Returns [value, nextPos]; value is null when
 *  no digits are present. */
function readDigits(src: string, pos: number): [number | null, number] {
  let end = pos;
  while (end < src.length && src[end] >= "0" && src[end] <= "9") {
    end += 1;
  }
  if (end === pos) return [null, pos];
  return [Number.parseInt(src.slice(pos, end), 10), end];
}
