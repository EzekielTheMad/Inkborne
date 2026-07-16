import { describe, it, expect } from "vitest";
import type { ActiveEffect } from "@/lib/types/active-effects";
import type { CharacterState } from "@/lib/types/character";
import {
  addActiveEffect,
  removeActiveEffect,
  dropConcentrationEffects,
  collectActiveEffects,
  collectRollModifiers,
  computeExpiresAt,
  isExpired,
  formatRemaining,
  buildActiveEffectFromSpell,
  buildCustomActiveEffect,
  applyActiveEffectPatch,
  removeActiveEffectPatch,
  type SpellEffectSource,
} from "@/lib/active-effects/helpers";

const NOW = new Date("2026-07-15T12:00:00.000Z");

const mkEffect = (overrides: Partial<ActiveEffect> = {}): ActiveEffect => ({
  id: "e1",
  name: "Mage Armor",
  slug: "mage-armor",
  source: "spell",
  content_id: "content-1",
  effects: [
    {
      type: "mechanical",
      stat: "armor_class",
      op: "formula",
      expr: "13 + mod(dexterity)",
      tag: "ac_formula",
    },
  ],
  duration: { type: "hours", value: 8 },
  concentration: false,
  applied_at: NOW.toISOString(),
  expires_at: "2026-07-15T20:00:00.000Z",
  ...overrides,
});

const mageArmorSpell: SpellEffectSource = {
  id: "content-1",
  name: "Mage Armor",
  slug: "mage-armor",
  effects: [
    {
      type: "mechanical",
      stat: "armor_class",
      op: "formula",
      expr: "13 + mod(dexterity)",
      tag: "ac_formula",
    },
  ],
  data: { duration: "8 hours", concentration: false },
};

describe("array mutations", () => {
  it("addActiveEffect appends immutably", () => {
    const current = [mkEffect()];
    const entry = mkEffect({ id: "e2", name: "Shield" });
    const next = addActiveEffect(current, entry);
    expect(next).toHaveLength(2);
    expect(next[1].id).toBe("e2");
    expect(current).toHaveLength(1); // untouched
  });

  it("removeActiveEffect removes by id immutably", () => {
    const current = [mkEffect(), mkEffect({ id: "e2" })];
    const next = removeActiveEffect(current, "e1");
    expect(next.map((e) => e.id)).toEqual(["e2"]);
    expect(current).toHaveLength(2);
  });

  it("removeActiveEffect with unknown id is a no-op copy", () => {
    const current = [mkEffect()];
    expect(removeActiveEffect(current, "nope")).toHaveLength(1);
  });

  it("dropConcentrationEffects strips only concentration:true entries", () => {
    const current = [
      mkEffect(),
      mkEffect({ id: "e2", name: "Bless", concentration: true }),
      mkEffect({ id: "e3", name: "Heroism", concentration: true }),
    ];
    const next = dropConcentrationEffects(current);
    expect(next.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("expiry", () => {
  it("computeExpiresAt returns applied_at + hours for hours durations", () => {
    expect(computeExpiresAt({ type: "hours", value: 8 }, NOW)).toBe(
      "2026-07-15T20:00:00.000Z",
    );
  });

  it("computeExpiresAt returns null for combat-scale and open durations", () => {
    expect(computeExpiresAt({ type: "rounds", value: 1 }, NOW)).toBeNull();
    expect(computeExpiresAt({ type: "minutes", value: 10 }, NOW)).toBeNull();
    expect(computeExpiresAt({ type: "until_rest" }, NOW)).toBeNull();
    expect(computeExpiresAt({ type: "special" }, NOW)).toBeNull();
  });

  it("isExpired compares against the injectable clock", () => {
    const effect = mkEffect(); // expires 20:00
    expect(isExpired(effect, new Date("2026-07-15T19:59:00Z"))).toBe(false);
    expect(isExpired(effect, new Date("2026-07-15T20:00:00Z"))).toBe(true);
    expect(isExpired(effect, new Date("2026-07-16T09:00:00Z"))).toBe(true);
  });

  it("isExpired is false for entries without expires_at", () => {
    const effect = mkEffect({
      duration: { type: "minutes", value: 1 },
      expires_at: null,
    });
    expect(isExpired(effect, new Date("2099-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("formatRemaining", () => {
  it("counts down real-time (hours) durations", () => {
    const effect = mkEffect(); // expires 20:00
    expect(formatRemaining(effect, new Date("2026-07-15T12:08:00Z"))).toBe(
      "7h 52m",
    );
    expect(formatRemaining(effect, new Date("2026-07-15T19:40:00Z"))).toBe(
      "20m",
    );
    expect(formatRemaining(effect, new Date("2026-07-15T21:00:00Z"))).toBe(
      "expired",
    );
  });

  it("shows static denomination for minutes (combat scale)", () => {
    const effect = mkEffect({
      duration: { type: "minutes", value: 1 },
      expires_at: null,
    });
    expect(formatRemaining(effect, NOW)).toBe("1 min (10 rounds)");
  });

  it("shows static denomination for rounds", () => {
    expect(
      formatRemaining(
        mkEffect({ duration: { type: "rounds", value: 1 }, expires_at: null }),
        NOW,
      ),
    ).toBe("1 round");
    expect(
      formatRemaining(
        mkEffect({ duration: { type: "rounds", value: 3 }, expires_at: null }),
        NOW,
      ),
    ).toBe("3 rounds");
  });

  it("labels open-ended durations", () => {
    expect(
      formatRemaining(
        mkEffect({ duration: { type: "until_rest" }, expires_at: null }),
        NOW,
      ),
    ).toBe("until rest");
    expect(
      formatRemaining(
        mkEffect({ duration: { type: "special" }, expires_at: null }),
        NOW,
      ),
    ).toBe("until removed");
  });
});

describe("collectActiveEffects", () => {
  it("flatMaps snapshots of non-expired entries", () => {
    const current = [
      mkEffect(),
      mkEffect({
        id: "e2",
        name: "Shield",
        effects: [
          { type: "mechanical", stat: "armor_class", op: "add", value: 5 },
        ],
        duration: { type: "rounds", value: 1 },
        expires_at: null,
      }),
    ];
    const collected = collectActiveEffects(current, NOW);
    expect(collected).toHaveLength(2);
    expect(collected[1]).toMatchObject({ stat: "armor_class", op: "add" });
  });

  it("excludes expired entries", () => {
    const current = [mkEffect()]; // expires 20:00
    expect(
      collectActiveEffects(current, new Date("2026-07-15T21:00:00Z")),
    ).toHaveLength(0);
  });

  it("returns [] for undefined and empty inputs", () => {
    expect(collectActiveEffects(undefined, NOW)).toEqual([]);
    expect(collectActiveEffects([], NOW)).toEqual([]);
  });
});

describe("buildActiveEffectFromSpell", () => {
  const opts = { now: NOW, generateId: () => "fixed-id" };

  it("snapshots effects[] and computes expires_at for hours durations", () => {
    const entry = buildActiveEffectFromSpell(mageArmorSpell, 1, opts);
    expect(entry).toMatchObject({
      id: "fixed-id",
      name: "Mage Armor",
      slug: "mage-armor",
      source: "spell",
      content_id: "content-1",
      duration: { type: "hours", value: 8 },
      concentration: false,
      cast_at_level: 1,
      applied_at: NOW.toISOString(),
      expires_at: "2026-07-15T20:00:00.000Z",
    });
    expect(entry.effects).toHaveLength(1);
    // Snapshot, not reference: mutating source content must not touch the entry
    expect(entry.effects).not.toBe(mageArmorSpell.effects);
  });

  it("prefers pre-parsed duration_structured over the string", () => {
    const entry = buildActiveEffectFromSpell(
      {
        ...mageArmorSpell,
        data: {
          duration: "gibberish",
          duration_structured: { type: "minutes", value: 10 },
        },
      },
      1,
      opts,
    );
    expect(entry.duration).toEqual({ type: "minutes", value: 10 });
    expect(entry.expires_at).toBeNull();
  });

  it("marks concentration and null expires_at for combat-scale durations", () => {
    const entry = buildActiveEffectFromSpell(
      {
        id: "content-2",
        name: "Bless",
        slug: "bless",
        effects: [
          { type: "mechanical", stat: "roll_attack", op: "add", value: "1d4" },
        ],
        data: { duration: "1 minute", concentration: true },
      },
      1,
      opts,
    );
    expect(entry.concentration).toBe(true);
    expect(entry.duration).toEqual({ type: "minutes", value: 1 });
    expect(entry.expires_at).toBeNull();
  });

  it("tolerates missing effects and cast level", () => {
    const entry = buildActiveEffectFromSpell(
      {
        name: "Custom Buff",
        slug: "custom-buff",
        data: { duration: "1 hour" },
      },
      undefined,
      opts,
    );
    expect(entry.effects).toEqual([]);
    expect(entry.cast_at_level).toBeUndefined();
    expect(entry.content_id).toBeNull();
  });
});

describe("buildCustomActiveEffect", () => {
  const opts = { now: NOW, generateId: () => "custom-id" };

  it("builds a mechanical add effect from a flat stat modifier", () => {
    const entry = buildCustomActiveEffect(
      {
        name: "Half cover",
        stat: "armor_class",
        value: 2,
        duration: { type: "special" },
      },
      opts,
    );
    expect(entry).toMatchObject({
      id: "custom-id",
      slug: "custom",
      source: "custom",
      content_id: null,
      concentration: false,
      expires_at: null,
    });
    expect(entry.effects).toEqual([
      { type: "mechanical", stat: "armor_class", op: "add", value: 2 },
    ]);
  });

  it("builds a display-only entry when no stat is given", () => {
    const entry = buildCustomActiveEffect(
      { name: "Blessed by the oracle", duration: { type: "until_rest" } },
      opts,
    );
    expect(entry.effects).toEqual([]);
  });

  it("computes expires_at for hours durations", () => {
    const entry = buildCustomActiveEffect(
      { name: "Potion buff", duration: { type: "hours", value: 1 } },
      opts,
    );
    expect(entry.expires_at).toBe("2026-07-15T13:00:00.000Z");
  });
});

describe("applyActiveEffectPatch", () => {
  it("appends non-concentration entries without touching concentrating_on", () => {
    const state: CharacterState = { active_effects: [mkEffect()] };
    const entry = mkEffect({ id: "e2", name: "Shield" });
    const patch = applyActiveEffectPatch(state, entry);
    expect(patch.active_effects).toHaveLength(2);
    expect("concentrating_on" in patch).toBe(false);
  });

  it("replaces concentration atomically: strips old linked effects, sets concentrating_on", () => {
    const oldBless = mkEffect({
      id: "e-bless",
      name: "Bless",
      slug: "bless",
      concentration: true,
    });
    const state: CharacterState = {
      active_effects: [mkEffect(), oldBless],
      concentrating_on: {
        spell_slug: "bless",
        spell_name: "Bless",
        slot_level: 1,
        started_at: "2026-07-15T11:00:00.000Z",
      },
    };
    const heroism = mkEffect({
      id: "e-heroism",
      name: "Heroism",
      slug: "heroism",
      concentration: true,
      cast_at_level: 2,
      applied_at: NOW.toISOString(),
    });
    const patch = applyActiveEffectPatch(state, heroism);
    expect(patch.active_effects?.map((e) => e.id)).toEqual([
      "e1",
      "e-heroism",
    ]);
    expect(patch.concentrating_on).toEqual({
      spell_slug: "heroism",
      spell_name: "Heroism",
      slot_level: 2,
      started_at: NOW.toISOString(),
    });
  });

  it("handles empty state", () => {
    const entry = mkEffect();
    const patch = applyActiveEffectPatch({}, entry);
    expect(patch.active_effects).toEqual([entry]);
  });
});

describe("removeActiveEffectPatch", () => {
  it("removes a plain entry without touching concentrating_on", () => {
    const state: CharacterState = {
      active_effects: [mkEffect(), mkEffect({ id: "e2" })],
    };
    const patch = removeActiveEffectPatch(state, "e2");
    expect(patch.active_effects?.map((e) => e.id)).toEqual(["e1"]);
    expect("concentrating_on" in patch).toBe(false);
  });

  it("clears concentrating_on when removing the last linked entry", () => {
    const state: CharacterState = {
      active_effects: [
        mkEffect(),
        mkEffect({ id: "e-bless", concentration: true }),
      ],
      concentrating_on: {
        spell_slug: "bless",
        spell_name: "Bless",
        slot_level: 1,
        started_at: NOW.toISOString(),
      },
    };
    const patch = removeActiveEffectPatch(state, "e-bless");
    expect(patch.active_effects?.map((e) => e.id)).toEqual(["e1"]);
    expect(patch.concentrating_on).toBeNull();
  });

  it("keeps concentrating_on when other linked entries remain", () => {
    const state: CharacterState = {
      active_effects: [
        mkEffect({ id: "c1", concentration: true }),
        mkEffect({ id: "c2", concentration: true }),
      ],
    };
    const patch = removeActiveEffectPatch(state, "c1");
    expect("concentrating_on" in patch).toBe(false);
    expect(patch.active_effects?.map((e) => e.id)).toEqual(["c2"]);
  });
});

describe("collectRollModifiers", () => {
  const bless = mkEffect({
    id: "e-bless",
    name: "Bless",
    concentration: true,
    duration: { type: "minutes", value: 1 },
    expires_at: null,
    effects: [
      { type: "mechanical", stat: "roll_attack", op: "add", value: "1d4" },
      { type: "mechanical", stat: "roll_save", op: "add", value: "1d4" },
      { type: "narrative", text: "Add a d4 to attacks and saves." },
    ],
  });
  const bane = mkEffect({
    id: "e-bane",
    name: "Bane",
    duration: { type: "minutes", value: 1 },
    expires_at: null,
    effects: [
      { type: "mechanical", stat: "roll_attack", op: "add", value: "-1d4" },
    ],
  });

  it("collects modifiers matching the roll kind with effect names", () => {
    expect(collectRollModifiers([bless, bane], "attack", NOW)).toEqual([
      { name: "Bless", dice: "1d4" },
      { name: "Bane", dice: "-1d4" },
    ]);
    expect(collectRollModifiers([bless, bane], "save", NOW)).toEqual([
      { name: "Bless", dice: "1d4" },
    ]);
    expect(collectRollModifiers([bless, bane], "check", NOW)).toEqual([]);
  });

  it("skips expired entries and non-dice values", () => {
    const expired = mkEffect({
      id: "e-exp",
      name: "Old Bless",
      effects: [
        { type: "mechanical", stat: "roll_attack", op: "add", value: "1d4" },
      ],
    }); // hours duration, expires 20:00
    expect(
      collectRollModifiers([expired], "attack", new Date("2026-07-15T21:00:00Z")),
    ).toEqual([]);

    const numeric = mkEffect({
      id: "e-num",
      expires_at: null,
      effects: [
        { type: "mechanical", stat: "roll_attack", op: "add", value: 1 },
      ],
    });
    expect(collectRollModifiers([numeric], "attack", NOW)).toEqual([]);
  });

  it("returns [] for undefined input", () => {
    expect(collectRollModifiers(undefined, "attack", NOW)).toEqual([]);
  });
});
