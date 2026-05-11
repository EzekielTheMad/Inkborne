import type { CSSProperties } from "react";

/**
 * Returns an inline-style object that sets `--character-color` for descendant
 * components to consume via the `--character-bg`, `--character-border`,
 * `--character-fg`, and `--character-muted` Tailwind theme tokens.
 *
 * When `primaryColor` is null, returns an empty object — descendants fall back
 * to the gold default defined in `app/globals.css`.
 */
export function characterColorStyle(
  primaryColor: string | null,
): CSSProperties {
  if (!primaryColor) return {};
  return { ["--character-color" as string]: primaryColor };
}
