import type { CSSProperties } from "react";

const palettes = {
  light: {
    page: "#F4F0E6",
    surface: "#FFFCF5",
    text: "#282A25",
    action: "#785923",
    onAction: "#FFFCF5",
  },
  dark: {
    page: "#0B0A10",
    surface: "#1A1626",
    text: "#F0EEF5",
    action: "#C9A44A",
    onAction: "#0B0A10",
  },
} as const;

type NotebookTheme = keyof typeof palettes;

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function mix(from: string, to: string, amount: number): string {
  const target = channels(to);
  return "#" + channels(from).map((value, index) =>
    Math.round(value + (target[index] - value) * amount).toString(16).padStart(2, "0"),
  ).join("").toUpperCase();
}

function luminance(hex: string): number {
  const rgb = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readableTone(source: string, neutral: string, backgrounds: string[], target: number): string {
  if (backgrounds.every((background) => contrast(source, background) >= target)) return source;
  // Check rounded, opaque output so the actual CSS value meets the target.
  for (let step = 1; step <= 255; step++) {
    const candidate = mix(source, neutral, step / 255);
    if (backgrounds.every((background) => contrast(candidate, background) >= target)) return candidate;
  }
  return neutral;
}

function themeRoles(savedHex: string | null, theme: NotebookTheme) {
  const palette = palettes[theme];
  const source = typeof savedHex === "string" && /^#[\da-f]{6}$/i.test(savedHex)
    ? savedHex
    : palette.action;
  const bg = mix(palette.surface, source, theme === "light" ? 0.08 : 0.12);
  const backgrounds = [palette.page, palette.surface, bg];
  const fg = readableTone(source, palette.text, backgrounds, 4.5);
  const fill = readableTone(source, palette.text, [palette.page, palette.surface], 3);
  const onFill = [palette.onAction, palette.text, "#000000", "#FFFFFF"]
    .find((candidate) => contrast(candidate, fill) >= 4.5)!;
  // Preserve the player's exact color at the leading edge. Moving each channel
  // away from the chosen ink keeps the entire sRGB gradient readable.
  const onHeader = contrast("#FFFFFF", source) >= contrast("#000000", source) ? "#FFFFFF" : "#000000";

  return {
    source,
    fg,
    muted: readableTone(mix(fg, palette.surface, 0.18), palette.text, backgrounds, 4.5),
    bg,
    border: readableTone(source, palette.text, backgrounds, 3),
    fill,
    "on-fill": onFill,
    header: source,
    "header-end": mix(source, onHeader === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.3),
    "on-header": onHeader,
  };
}

/**
 * Theme-specific character roles, ready for server HTML and portaled surfaces.
 * The saved source is preserved exactly; derived tones never become saved data.
 * Null or invalid input follows each theme's site accent. CSS selects a theme's
 * map without waiting for a browser read, hydration, or a theme effect.
 */
export function characterNotebookStyle(savedHex: string | null): CSSProperties {
  return Object.fromEntries((["light", "dark"] as const).flatMap((theme) =>
    Object.entries(themeRoles(savedHex, theme)).map(([role, value]) => [
      `--character-${theme}-${role}`, value,
    ]),
  ));
}
