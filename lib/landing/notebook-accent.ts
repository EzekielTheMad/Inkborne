import type { CSSProperties } from "react";
import type { ResolvedTheme } from "@/lib/theme";

// Public example only. This does not change saved characters or app-wide tokens.
const palettes = {
  light: { page: "#F4F0E6", surface: "#FFFCF5", raised: "#F7F0E2", ink: "#282A25", action: "#785923" },
  dark: { page: "#0B0A10", surface: "#1A1626", raised: "#211B30", ink: "#F0EEF5", action: "#C9A44A" },
} as const;

function channels(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function mix(from: string, to: string, amount: number) {
  const target = channels(to);
  return "#" + channels(from).map((value, index) =>
    Math.round(value + (target[index] - value) * amount).toString(16).padStart(2, "0"),
  ).join("");
}

function luminance(hex: string) {
  const rgb = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

export function accentContrast(a: string, b: string) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function readableTone(source: string, neutral: string, backgrounds: string[], target: number) {
  for (let step = 0; step <= 255; step++) {
    const candidate = mix(source, neutral, step / 255);
    if (backgrounds.every((background) => accentContrast(candidate, background) >= target)) return candidate;
  }
  return neutral;
}

export function notebookAccent(source: string | null, theme: ResolvedTheme): CSSProperties {
  const palette = palettes[theme];
  const seed = source && /^#[\da-f]{6}$/i.test(source) ? source : palette.action;
  const tint = mix(palette.surface, seed, theme === "light" ? .06 : .10);
  const backgrounds = [palette.page, palette.surface, palette.raised, tint];
  const onFill = ["#000000", "#FFFFFF"].find((color) => accentContrast(seed, color) >= 4.5)!;
  return {
    "--demo-source": seed,
    "--demo-fg": readableTone(seed, palette.ink, backgrounds, 4.5),
    "--demo-border": readableTone(seed, palette.ink, backgrounds, 3),
    "--demo-fill": seed,
    "--demo-on-fill": onFill,
    "--demo-tint": tint,
  } as CSSProperties;
}

// Both variants are present in server HTML. The document's prepaint theme class
// selects the correct tones before React hydrates, just like the page palette.
export function notebookAccentStyle(source: string | null): CSSProperties {
  return Object.fromEntries((["light", "dark"] as const).flatMap((theme) =>
    Object.entries(notebookAccent(source, theme)).map(([key, value]) => [
      key.replace("--demo-", `--demo-${theme}-`), value,
    ]),
  ));
}
