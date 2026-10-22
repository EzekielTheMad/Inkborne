/* Static design-study color roles. This is not an application theme migration. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.InkborneCharacterColors = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const palette = Object.freeze({
    light: Object.freeze({
      bg: "#F4F0E6", surface: "#FFFCF5", text: "#282A25", muted: "#655B6D",
      rule: "#D7CEDD", boundary: "#8A7B92", action: "#785923",
      onAction: "#FFFCF5", focus: "#70448D",
    }),
    dark: Object.freeze({
      bg: "#0B0A10", surface: "#1A1626", text: "#F0EEF5", muted: "#BBB0CA",
      rule: "#393047", boundary: "#81718E", action: "#C9A44A",
      onAction: "#0B0A10", focus: "#D0ABEE",
    }),
  });

  const presets = Object.freeze([
    Object.freeze({ name: "Gold", hex: "#c9a44a" }),
    Object.freeze({ name: "Purple", hex: "#7c3aed" }),
    Object.freeze({ name: "Red", hex: "#b91c1c" }),
    Object.freeze({ name: "Emerald", hex: "#059669" }),
    Object.freeze({ name: "Blue", hex: "#2563eb" }),
    Object.freeze({ name: "Magenta", hex: "#db2777" }),
  ]);

  function channels(hex) {
    if (typeof hex !== "string" || !/^#[\da-f]{6}$/i.test(hex)) {
      throw new TypeError("Expected an opaque #RRGGBB color.");
    }
    return [1, 3, 5].map(function (offset) { return parseInt(hex.slice(offset, offset + 2), 16); });
  }

  function toHex(rgb) {
    return "#" + rgb.map(function (value) {
      return Math.round(value).toString(16).padStart(2, "0");
    }).join("").toUpperCase();
  }

  function mix(from, to, amount) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError("Blend amount must be between zero and one.");
    }
    const a = channels(from);
    const b = channels(to);
    return toHex(a.map(function (value, index) { return value + (b[index] - value) * amount; }));
  }

  function luminance(hex) {
    const rgb = channels(hex).map(function (channel) {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }

  function contrast(a, b) {
    const first = luminance(a);
    const second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }

  function minimumContrast(color, backgrounds) {
    return Math.min.apply(null, backgrounds.map(function (background) { return contrast(color, background); }));
  }

  // Blend toward a readable neutral, keeping as much of the source hue as the
  // role permits. Check the rounded opaque output, rather than an ideal float.
  function readableTone(seed, neutral, backgrounds, target) {
    if (minimumContrast(seed, backgrounds) >= target) return toHex(channels(seed));
    for (let step = 1; step <= 255; step += 1) {
      const candidate = mix(seed, neutral, step / 255);
      if (minimumContrast(candidate, backgrounds) >= target) return candidate;
    }
    const fallback = [neutral, "#000000", "#FFFFFF"].find(function (candidate) {
      return minimumContrast(candidate, backgrounds) >= target;
    });
    if (!fallback) throw new RangeError("No common readable tone for these surfaces.");
    return fallback;
  }

  function fillText(fill, themePalette) {
    const candidates = [themePalette.onAction, themePalette.text, "#000000", "#FFFFFF"];
    return candidates.find(function (candidate) { return contrast(candidate, fill) >= 4.5; });
  }

  function resolve(seedHexOrNull, theme) {
    if (!Object.prototype.hasOwnProperty.call(palette, theme)) {
      throw new TypeError("Theme must be light or dark.");
    }
    const colors = palette[theme];
    const source = seedHexOrNull === null ? colors.action : seedHexOrNull;
    channels(source); // Validate without changing the saved source string.
    const tint = mix(colors.surface, source, theme === "light" ? 0.08 : 0.12);
    const backgrounds = [colors.bg, colors.surface, tint];
    const fg = readableTone(source, colors.text, backgrounds, 4.5);
    const mutedSeed = mix(fg, colors.surface, 0.18);
    const fill = seedHexOrNull === null ? colors.action : toHex(channels(source));
    return Object.freeze({
      source: source,
      fg: fg,
      fill: fill,
      onFill: fillText(fill, colors),
      tint: tint,
      border: readableTone(source, colors.text, backgrounds, 3),
      muted: readableTone(mutedSeed, colors.text, backgrounds, 4.5),
    });
  }

  return Object.freeze({
    palette: palette, presets: presets, resolve: resolve,
    luminance: luminance, contrast: contrast, minimumContrast: minimumContrast, mix: mix,
  });
});
