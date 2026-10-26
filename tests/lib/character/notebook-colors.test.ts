import { describe, expect, it } from "vitest";
import { characterNotebookStyle } from "@/lib/character/notebook-colors";

const palettes = {
  light: { page: "#F4F0E6", surface: "#FFFCF5", text: "#282A25", action: "#785923" },
  dark: { page: "#0B0A10", surface: "#1A1626", text: "#F0EEF5", action: "#C9A44A" },
} as const;
const themes = ["light", "dark"] as const;
const roles = ["source", "fg", "muted", "bg", "border", "fill", "on-fill", "header", "header-end", "on-header"] as const;

// Independent WCAG calculation: inspect the emitted hex values, not resolver helpers.
function ratio(first: string, second: string): number {
  function relative(hex: string): number {
    const bytes = hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16) / 255);
    const linear = bytes.map((value) => value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4));
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  const a = relative(first);
  const b = relative(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function inspect(seed: string | null) {
  const style = characterNotebookStyle(seed) as Record<string, string>;
  expect(Object.keys(style).sort()).toEqual(themes.flatMap((theme) =>
    roles.map((role) => `--character-${theme}-${role}`),
  ).sort());

  for (const theme of themes) {
    const color = (role: typeof roles[number]) => style[`--character-${theme}-${role}`];
    const palette = palettes[theme];
    for (const role of roles) expect(color(role)).toMatch(/^#[\da-f]{6}$/i);
    expect(color("source")).toBe(seed ?? palette.action);
    const surfaces = [palette.page, palette.surface, color("bg")];
    for (const surface of surfaces) {
      for (const role of ["fg", "muted"] as const) {
        expect(ratio(color(role), surface), `${seed}/${theme}/${role} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio(color("border"), surface), `${seed}/${theme}/border on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    expect(ratio(palette.text, color("bg")), `${seed}/${theme}/body on tint`).toBeGreaterThanOrEqual(4.5);
    for (const surface of [palette.page, palette.surface]) {
      expect(ratio(color("fill"), surface), `${seed}/${theme}/fill on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    expect(ratio(color("on-fill"), color("fill")), `${seed}/${theme}/text on fill`).toBeGreaterThanOrEqual(4.5);
    for (let step = 0; step <= 20; step++) {
      const start = color("header").slice(1).match(/../g)!.map((value) => parseInt(value, 16));
      const end = color("header-end").slice(1).match(/../g)!.map((value) => parseInt(value, 16));
      const sample = "#" + start.map((value, index) => Math.round(value + (end[index] - value) * step / 20).toString(16).padStart(2, "0")).join("");
      expect(ratio(color("on-header"), sample), `${seed}/${theme}/header at ${step}/20`).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(characterNotebookStyle(seed)).toEqual(style);
}

describe("characterNotebookStyle", () => {
  it.each([
    ["site default", null],
    ["Gold", "#c9a44a"],
    ["Purple", "#7c3aed"],
    ["Red", "#b91c1c"],
    ["Emerald", "#059669"],
    ["Blue", "#2563eb"],
    ["Magenta", "#db2777"],
    ["saturated yellow", "#FFFF00"],
    ["saturated red", "#FF0000"],
    ["near white", "#FEFEFC"],
    ["near black", "#010203"],
    ["white", "#FFFFFF"],
    ["black", "#000000"],
    ["arbitrary mixed-case custom", "#19A7bC"],
  ])("emits readable roles in both themes for %s", (_name, seed) => {
    inspect(seed);
  });

  it("retains the exact saved source while deriving other tones", () => {
    const style = characterNotebookStyle("#FfFf00") as Record<string, string>;
    expect(style["--character-light-source"]).toBe("#FfFf00");
    expect(style["--character-dark-source"]).toBe("#FfFf00");
    expect(style["--character-light-fg"]).not.toBe("#FfFf00");
    expect(style["--character-light-fill"]).not.toBe("#FfFf00");
  });

  it.each(["", "#FFF", "123456", "#12345678", "#12GG34", "red", "var(--accent)", " #123456"])(
    "uses the theme defaults for invalid input %s", (invalid) => {
      expect(characterNotebookStyle(invalid)).toEqual(characterNotebookStyle(null));
    },
  );

  it("handles malformed runtime values without emitting invalid CSS", () => {
    expect(characterNotebookStyle(undefined as unknown as string)).toEqual(characterNotebookStyle(null));
    expect(characterNotebookStyle(123456 as unknown as string)).toEqual(characterNotebookStyle(null));
  });

  it("keeps a saved site-colored hex custom until reset", () => {
    const defaultStyle = characterNotebookStyle(null) as Record<string, string>;
    const savedDark = characterNotebookStyle(palettes.dark.action) as Record<string, string>;
    const savedLight = characterNotebookStyle(palettes.light.action) as Record<string, string>;
    expect(defaultStyle["--character-light-source"]).toBe(palettes.light.action);
    expect(defaultStyle["--character-dark-source"]).toBe(palettes.dark.action);
    expect(defaultStyle["--character-light-fill"]).toBe(palettes.light.action);
    expect(defaultStyle["--character-dark-fill"]).toBe(palettes.dark.action);
    expect(savedDark["--character-light-source"]).toBe(palettes.dark.action);
    expect(savedLight["--character-dark-source"]).toBe(palettes.light.action);
    inspect(palettes.light.action);
    inspect(palettes.dark.action);
  });

  it("meets role contrast across the RGB cube, including midtone colors", () => {
    const levels = [0, 32, 64, 96, 128, 160, 192, 224, 255];
    for (const red of levels) for (const green of levels) for (const blue of levels) {
      const seed = "#" + [red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("");
      inspect(seed);
    }
  });
});
