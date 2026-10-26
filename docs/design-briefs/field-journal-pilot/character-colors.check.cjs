"use strict";

// Run with Node. These are design-role invariants, not application UI tests.
const assert = require("node:assert/strict");
const colors = require("./character-colors.js");
const { palette, resolve } = colors;

// Independent WCAG reference calculation avoids testing the production helper
// against itself and catches rounded output that misses a threshold.
function ratio(first, second) {
  function relative(hex) {
    const bytes = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255);
    const linear = bytes.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  const a = relative(first);
  const b = relative(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

assert.equal(colors.contrast("#000000", "#FFFFFF"), 21);
assert.equal(colors.contrast("#C9A44A", "#C9A44A"), 1);
assert.equal(colors.luminance("#FFFFFF"), 1);
assert.equal(colors.luminance("#000000"), 0);
assert.deepEqual(palette.light, { bg: "#F4F0E6", surface: "#FFFCF5", text: "#282A25", muted: "#655B6D", rule: "#D7CEDD", boundary: "#8A7B92", action: "#785923", onAction: "#FFFCF5", focus: "#70448D" });
assert.deepEqual(palette.dark, { bg: "#0B0A10", surface: "#1A1626", text: "#F0EEF5", muted: "#BBB0CA", rule: "#393047", boundary: "#81718E", action: "#C9A44A", onAction: "#0B0A10", focus: "#D0ABEE" });
for (const theme of ["light", "dark"]) {
  for (const surface of [palette[theme].bg, palette[theme].surface]) {
    assert.ok(ratio(palette[theme].text, surface) >= 4.5, `${theme}: base text`);
    assert.ok(ratio(palette[theme].muted, surface) >= 4.5, `${theme}: supporting text`);
    assert.ok(ratio(palette[theme].boundary, surface) >= 3, `${theme}: control boundary`);
    assert.ok(ratio(palette[theme].focus, surface) >= 3, `${theme}: focus ring`);
  }
  assert.ok(ratio(palette[theme].onAction, palette[theme].action) >= 4.5, `${theme}: brand action text`);
}

const namedCases = [
  { name: "Site default", seed: null },
  ...colors.presets.map((preset) => ({ name: preset.name, seed: preset.hex })),
  { name: "Saturated yellow", seed: "#FFFF00" },
  { name: "Saturated red", seed: "#FF0000" },
  { name: "Near white", seed: "#FEFEFC" },
  { name: "Near black", seed: "#010203" },
  { name: "Arbitrary teal", seed: "#19A7bC" },
  { name: "Saved light site accent", seed: palette.light.action },
  { name: "Saved dark site accent", seed: palette.dark.action },
];

let checked = 0;
let lowestText = Infinity;
let lowestBoundary = Infinity;
let lowestOnFill = Infinity;
function inspect(seed, theme, name) {
  const roles = resolve(seed, theme);
  const surfaces = [palette[theme].bg, palette[theme].surface, roles.tint];
  assert.equal(roles.source, seed === null ? palette[theme].action : seed, `${name}: exact source survives`);
  assert.deepEqual(Object.keys(roles).sort(), ["source", "fg", "fill", "onFill", "tint", "border", "muted"].sort());
  for (const [role, value] of Object.entries(roles)) {
    assert.match(value, /^#[a-f\d]{6}$/i, `${name}/${theme}/${role}: opaque hex`);
  }
  if (seed === null) assert.equal(roles.fill, palette[theme].action, `${theme}: exact site default fill`);
  for (const surface of surfaces) {
    for (const role of ["fg", "muted"]) {
      const actual = ratio(roles[role], surface);
      assert.ok(actual >= 4.5, `${name}/${theme}/${role} against ${surface}: ${actual}`);
      lowestText = Math.min(lowestText, actual);
    }
    const boundary = ratio(roles.border, surface);
    assert.ok(boundary >= 3, `${name}/${theme}/border against ${surface}: ${boundary}`);
    lowestBoundary = Math.min(lowestBoundary, boundary);
  }
  const onFill = ratio(roles.onFill, roles.fill);
  assert.ok(onFill >= 4.5, `${name}/${theme}/onFill: ${onFill}`);
  lowestOnFill = Math.min(lowestOnFill, onFill);
  assert.deepEqual(resolve(seed, theme), roles, `${name}: deterministic roles`);
  checked += 1;
}

for (const { name, seed } of namedCases) {
  inspect(seed, "light", name);
  inspect(seed, "dark", name);
  if (seed !== null) assert.equal(resolve(seed, "light").source, resolve(seed, "dark").source, `${name}: theme retains source`);
}

// Sample the full RGB cube, including exact black/white and midtone regions.
const levels = [0, 32, 64, 96, 128, 160, 192, 224, 255];
for (const red of levels) for (const green of levels) for (const blue of levels) {
  const seed = "#" + [red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("");
  inspect(seed, "light", "RGB cube " + seed);
  inspect(seed, "dark", "RGB cube " + seed);
}

// Reset and custom equality remain distinct: a saved hex follows the custom
// identity in the other theme, while null follows that theme's site accent.
assert.equal(resolve(palette.light.action, "dark").source, palette.light.action);
assert.equal(resolve(null, "dark").source, palette.dark.action);
assert.notEqual(resolve(null, "light").fill, resolve(null, "dark").fill);
assert.throws(() => resolve(undefined, "light"), /#RRGGBB/);
assert.throws(() => resolve("#FFF", "light"), /#RRGGBB/);
assert.throws(() => resolve("transparent", "light"), /#RRGGBB/);
assert.throws(() => resolve(null, "system"), /light or dark/);

console.log(`PASS: ${checked} light/dark role sets, including ${namedCases.length} named cases and ${levels.length ** 3} RGB samples.`);
console.log(`Minimum contrast: text ${lowestText.toFixed(4)}:1; boundary ${lowestBoundary.toFixed(4)}:1; on-fill ${lowestOnFill.toFixed(4)}:1.`);
console.log("PASS: exact custom source retention, theme-aware default, reset distinction, opaque roles, determinism, invalid input rejection.");
