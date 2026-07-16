import type { EffectDuration } from "@/lib/types/active-effects";

/**
 * Parse an SRD-style spell duration string into a structured `EffectDuration`.
 *
 * Handles both PHB phrasing ("Concentration, up to 1 minute") and dnd5eapi
 * phrasing ("Up to 1 minute", "1 minute", "8 hours", "Instantaneous",
 * "Until dispelled"). Content may also carry a pre-parsed
 * `duration_structured` field (enriched by migration for the starter buff
 * set) — this parser is the fallback for everything else, imported homebrew
 * included.
 *
 * Never throws: unknown strings map to `{ type: "special" }` (manual removal
 * only), which is the honest default for durations we can't automate.
 */
export function parseSpellDuration(duration: string): EffectDuration {
  const normalized = duration
    .toLowerCase()
    .replace(/^concentration,?\s*/, "")
    .replace(/^up to\s*/, "")
    .trim();

  if (normalized === "instantaneous") {
    return { type: "instantaneous" };
  }

  if (normalized.startsWith("until dispelled")) {
    return { type: "special" };
  }

  if (normalized === "until the end of your next short or long rest" ||
      normalized === "until you finish a short or long rest") {
    return { type: "until_rest" };
  }

  const match = normalized.match(/^(\d+)\s*(round|minute|hour|day)s?$/);
  if (match) {
    const value = parseInt(match[1], 10);
    if (value > 0) {
      switch (match[2]) {
        case "round":
          return { type: "rounds", value };
        case "minute":
          return { type: "minutes", value };
        case "hour":
          return { type: "hours", value };
        case "day":
          return { type: "hours", value: value * 24 };
      }
    }
  }

  return { type: "special" };
}
