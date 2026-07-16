import { describe, it, expect } from "vitest";
import {
  activeEffectSchema,
  effectDurationSchema,
} from "@/lib/schemas/active-effects";
import { mechanicalEffectSchema } from "@/lib/schemas/effects";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";

const validEntry = {
  id: "3f0f6f5a-6b0a-4a1a-9c8e-2d1f0e9b8a7c",
  name: "Mage Armor",
  slug: "mage-armor",
  source: "spell",
  content_id: "0d3c1a2b-4e5f-6789-abcd-ef0123456789",
  effects: [
    {
      type: "mechanical",
      stat: "armor_class",
      op: "formula",
      expr: "13 + mod(dexterity)",
      tag: "ac_formula",
      condition: { field: "equipped_armor", op: "eq", value: "none" },
    },
  ],
  duration: { type: "hours", value: 8 },
  concentration: false,
  cast_at_level: 1,
  applied_at: "2026-07-15T12:00:00.000Z",
  expires_at: "2026-07-15T20:00:00.000Z",
};

describe("effectDurationSchema", () => {
  it("validates every duration kind", () => {
    for (const duration of [
      { type: "rounds", value: 1 },
      { type: "minutes", value: 10 },
      { type: "hours", value: 8 },
      { type: "until_rest" },
      { type: "instantaneous" },
      { type: "special" },
    ]) {
      expect(effectDurationSchema.safeParse(duration).success).toBe(true);
    }
  });

  it("rejects non-positive and missing values on timed kinds", () => {
    expect(
      effectDurationSchema.safeParse({ type: "hours", value: 0 }).success,
    ).toBe(false);
    expect(effectDurationSchema.safeParse({ type: "minutes" }).success).toBe(
      false,
    );
    expect(effectDurationSchema.safeParse({ type: "eons" }).success).toBe(
      false,
    );
  });
});

describe("activeEffectSchema", () => {
  it("validates a full spell-sourced entry (condition + tag round-trip intact)", () => {
    const result = activeEffectSchema.safeParse(validEntry);
    expect(result.success).toBe(true);
    if (result.success) {
      // The mechanical snapshot must keep its condition and tag — they gate
      // evaluation (Mage Armor's unarmored condition).
      expect(result.data.effects[0]).toMatchObject({
        tag: "ac_formula",
        condition: { field: "equipped_armor", op: "eq", value: "none" },
      });
    }
  });

  it("validates a custom display-only entry", () => {
    const result = activeEffectSchema.safeParse({
      ...validEntry,
      slug: "custom",
      source: "custom",
      content_id: null,
      effects: [],
      duration: { type: "special" },
      expires_at: null,
      cast_at_level: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("rejects bad source, bad duration, and non-uuid id", () => {
    expect(
      activeEffectSchema.safeParse({ ...validEntry, source: "wish" }).success,
    ).toBe(false);
    expect(
      activeEffectSchema.safeParse({
        ...validEntry,
        duration: { type: "forever" },
      }).success,
    ).toBe(false);
    expect(
      activeEffectSchema.safeParse({ ...validEntry, id: "not-a-uuid" })
        .success,
    ).toBe(false);
  });
});

describe("mechanicalEffectSchema condition/tag extension", () => {
  it("accepts a single condition and an array of conditions", () => {
    expect(
      mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 1,
        condition: { field: "rage_active", op: "eq", value: true },
      }).success,
    ).toBe(true);
    expect(
      mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 1,
        condition: [
          { field: "equipped_armor", op: "eq", value: "none" },
          { field: "shield_equipped", op: "eq", value: false },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects malformed conditions", () => {
    expect(
      mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: 1,
        condition: { field: "equipped_armor", op: "gte", value: "none" },
      }).success,
    ).toBe(false);
  });
});

describe("spellDataSchema duration_structured extension", () => {
  const baseSpell = {
    level: 1,
    school: "abjuration",
    casting_time: "1 action",
    range: "Touch",
    components: ["V", "S", "M"],
    material: "A piece of cured leather.",
    duration: "8 hours",
    concentration: false,
    ritual: false,
    description: "You touch a willing creature...",
  };

  it("accepts a spell with duration_structured", () => {
    const result = spellDataSchema.safeParse({
      ...baseSpell,
      duration_structured: { type: "hours", value: 8 },
    });
    expect(result.success).toBe(true);
  });

  it("remains optional (unenriched spells still validate)", () => {
    expect(spellDataSchema.safeParse(baseSpell).success).toBe(true);
  });

  it("rejects malformed duration_structured", () => {
    expect(
      spellDataSchema.safeParse({
        ...baseSpell,
        duration_structured: { type: "hours" },
      }).success,
    ).toBe(false);
  });
});
