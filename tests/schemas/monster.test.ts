import { describe, expect, it } from "vitest";
import { parseContentByType } from "@/lib/schemas/content-types";
import { MONSTER_ABILITIES, MONSTER_PAYLOAD_MAX_BYTES, monsterDataSchema } from "@/lib/schemas/content-types/monster";
import { cinderlitKite, lanternReefRegent, monsterFixtures, monsterWithBytes } from "@/tests/fixtures/monsters";

function changed(path: string, value: unknown) {
  const data = structuredClone(lanternReefRegent);
  data.actions![0].attack!.range = { normal: 1, long: 10_000 };
  data.legendary_actions!.actions_per_round = 20;
  data.legendary_actions!.entries[0].cost = 1;
  const parts = path.split(".");
  let target = data as unknown as Record<string, unknown>;
  for (const key of parts.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[parts.at(-1)!] = value;
  return data;
}

describe("canonical monster format one", () => {
  it.each(monsterFixtures)("accepts the original $size fixture without altering it", (fixture) => {
    expect(monsterDataSchema.parse(fixture)).toEqual(fixture);
    expect(parseContentByType("monster", fixture).ok).toBe(true);
  });
  it.each(["schema_version", "size", "creature_type", "armor_class", "hit_points", "speed", "ability_scores"])("requires %s", (key) => {
    const data = { ...cinderlitKite } as Record<string, unknown>;
    delete data[key];
    expect(monsterDataSchema.safeParse(data).success).toBe(false);
  });
  it.each(MONSTER_ABILITIES)("requires the named %s score", (ability) => {
    expect(monsterDataSchema.safeParse(changed(`ability_scores.${ability}`, undefined)).success).toBe(false);
  });
  const numericBounds: Array<[string, number, number]> = [
    ...MONSTER_ABILITIES.map((ability): [string, number, number] => [`ability_scores.${ability}`, 1, 30]),
    ...MONSTER_ABILITIES.map((ability): [string, number, number] => [`saving_throws.${ability}`, -100, 100]),
    ...["walk", "fly", "swim", "climb", "burrow", "encumbered"].map((mode): [string, number, number] => [`speed.${mode}`, 0, 10_000]),
    ["armor_class.value", 0, 100], ["hit_points.average", 1, 1_000_000], ["skills.0.bonus", -100, 100],
    ["senses.0.range", 0, 10_000], ["passive_perception", 0, 100], ["challenge.experience_points", 0, 10_000_000],
    ["actions.0.attack.bonus", -100, 100], ["actions.0.attack.reach", 0, 10_000],
    ["actions.0.attack.range.normal", 1, 10_000], ["actions.0.attack.range.long", 1, 10_000],
    ["actions.0.saving_throw.dc", 0, 100], ["actions.0.damage.0.average", 0, 1_000_000],
    ["legendary_actions.actions_per_round", 1, 20], ["legendary_actions.entries.0.cost", 1, 20],
    ["lair_actions.initiative_count", 0, 100],
  ];
  it.each(numericBounds)("bounds %s to %s..%s", (path, minimum, maximum) => {
    for (const value of [minimum, maximum]) expect(monsterDataSchema.safeParse(changed(path, value)).success).toBe(true);
    for (const value of [minimum - 1, maximum + 1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null]) {
      expect(monsterDataSchema.safeParse(changed(path, value)).success).toBe(false);
    }
  });
  const textBounds: Array<[string, number]> = [
    ["creature_type", 80], ["alignment", 120], ["description", 8_000], ["armor_class.notes", 500],
    ["hit_points.dice_text", 120], ["speed.notes", 500], ["skills.0.name", 80], ["senses.0.notes", 500],
    ["senses_notes", 500], ["languages.0", 120], ["languages_notes", 500], ["challenge.rating", 40],
    ["damage_notes", 1_000], ["condition_immunities.0", 80], ["traits.0.name", 120], ["traits.0.description", 4_000],
    ["actions.0.name", 120], ["actions.0.description", 4_000], ["actions.0.attack.target", 200],
    ["actions.0.saving_throw.on_success", 500], ["actions.0.damage.0.roll_text", 120], ["actions.0.damage.0.notes", 500],
    ["legendary_actions.description", 4_000], ["lair_actions.description", 4_000],
  ];
  it.each(textBounds)("bounds text %s to %s code units", (path, maximum) => {
    expect(monsterDataSchema.safeParse(changed(path, "x".repeat(maximum))).success).toBe(true);
    for (const value of ["x".repeat(maximum + 1), "", " \n\t", null, 2]) {
      expect(monsterDataSchema.safeParse(changed(path, value)).success).toBe(false);
    }
  });
  it("preserves declared zeros/false and absent versus empty arrays without defaults", () => {
    const minimal = { schema_version: 1, size: "Small", creature_type: "construct", armor_class: { value: 0 },
      hit_points: { average: 1 }, speed: { fly: 0, hover: false }, ability_scores: cinderlitKite.ability_scores };
    expect(monsterDataSchema.parse(minimal)).toEqual(minimal);
    expect(monsterDataSchema.parse({ ...minimal, actions: [] })).toEqual({ ...minimal, actions: [] });
    expect(parseContentByType("not-a-monster", minimal)).toEqual({ ok: false, error: "unknown_content_type" });
  });
  it.each([0, 2, "1", null])( "rejects schema version %s", (schema_version) => {
    expect(monsterDataSchema.safeParse({ ...cinderlitKite, schema_version }).success).toBe(false);
  });
  it.each([["size", "small"], ["actions.0.damage.0.type", "magical"], ["senses.0.type", "echolocation"], ["actions.0.saving_throw.ability", "con"]])("rejects unknown taxonomy %s", (path, value) => {
    expect(monsterDataSchema.safeParse(changed(path, value)).success).toBe(false);
  });
  it.each(["", "armor_class", "hit_points", "speed", "ability_scores", "saving_throws", "skills.0", "senses.0", "challenge", "traits.0", "actions.0", "actions.0.attack", "actions.0.attack.range", "actions.0.saving_throw", "actions.0.damage.0", "legendary_actions", "legendary_actions.entries.0", "lair_actions", "lair_actions.entries.0"])("rejects unknown keys in %s", (path) => {
    const data = structuredClone(lanternReefRegent);
    let target = data as unknown as Record<string, unknown>;
    for (const part of path ? path.split(".") : []) target = target[part] as Record<string, unknown>;
    target.formula = "globalThis.compromised = true";
    expect(monsterDataSchema.safeParse(data).success).toBe(false);
  });
  const arrays: Array<[string, number, unknown]> = [
    ["skills", 30, { name: "Echo", bonus: 0 }], ["senses", 8, { type: "darkvision", range: 0 }],
    ["languages", 30, "Lantern signs"], ["condition_immunities", 30, "sleepy"],
    ...["damage_vulnerabilities", "damage_resistances", "damage_immunities"].map((key): [string, number, unknown] => [key, 13, "cold"]),
    ...["traits", "actions", "bonus_actions", "reactions", "legendary_actions.entries", "lair_actions.entries"].map((key): [string, number, unknown] => [key, 30, { name: "Echo", description: "A light opens." }]),
    ["actions.0.damage", 8, { type: "cold", average: 0 }],
  ];
  it.each(arrays)("bounds array %s to %s", (path, maximum, entry) => {
    expect(monsterDataSchema.safeParse(changed(path, Array.from({ length: maximum }, () => entry))).success).toBe(true);
    expect(monsterDataSchema.safeParse(changed(path, Array.from({ length: maximum + 1 }, () => entry))).success).toBe(false);
    expect(monsterDataSchema.safeParse(changed(path, null)).success).toBe(false);
  });
  it.each([65_535, 65_536, 65_537])("enforces aggregate UTF-8 bytes at %s", (bytes) => {
    const data = monsterWithBytes(bytes);
    expect(new TextEncoder().encode(JSON.stringify(data)).byteLength).toBe(bytes);
    expect(monsterDataSchema.safeParse(data).success).toBe(bytes <= MONSTER_PAYLOAD_MAX_BYTES);
  });
  it("counts multibyte text rather than only code units", () => {
    const data = monsterWithBytes(MONSTER_PAYLOAD_MAX_BYTES);
    data.traits![0].description = "é" + data.traits![0].description.slice(1);
    expect(data.traits![0].description).toHaveLength(4_000);
    expect(new TextEncoder().encode(JSON.stringify(data)).byteLength).toBe(MONSTER_PAYLOAD_MAX_BYTES + 1);
    expect(monsterDataSchema.safeParse(data).success).toBe(false);
  });
  it("refuses the sum of individually valid maximum descriptions", () => {
    expect(monsterDataSchema.safeParse({ ...cinderlitKite, traits: Array.from({ length: 30 }, () => ({ name: "Echo", description: "x".repeat(4_000) })) }).success).toBe(false);
  });
  it("requires mode/hover, nonempty saves and sections, valid damage and legendary costs", () => {
    for (const [path, value] of [
      ["speed", { notes: "Still" }], ["speed", { walk: 0, hover: false }], ["saving_throws", {}],
      ["actions.0.damage", []], ["actions.0.damage", [{ type: "cold", notes: "None declared" }]],
      ["legendary_actions.entries", []], ["lair_actions.entries", []],
      ["legendary_actions", { actions_per_round: 1, entries: [{ name: "Echo", description: "A light opens.", cost: 2 }] }],
      ["actions.0.cost", 1],
    ] as Array<[string, unknown]>) expect(monsterDataSchema.safeParse(changed(path, value)).success).toBe(false);
  });
  it("rejects omitted/mismatched attack reach and ranges without inferring them", () => {
    for (const attack of [
      { kind: "melee", attack_type: "weapon", bonus: 0 },
      { kind: "ranged", attack_type: "weapon", bonus: 0 },
      { kind: "melee", attack_type: "weapon", bonus: 0, reach: 0, range: { normal: 1 } },
      { kind: "ranged", attack_type: "weapon", bonus: 0, reach: 0, range: { normal: 1 } },
      { kind: "melee_or_ranged", attack_type: "spell", bonus: 0, reach: 0 },
      { kind: "ranged", attack_type: "weapon", bonus: 0, range: { normal: 10, long: 9 } },
    ]) expect(monsterDataSchema.safeParse(changed("actions.0.attack", attack)).success).toBe(false);
  });
});
