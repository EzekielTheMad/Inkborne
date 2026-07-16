import { describe, it, expect } from "vitest";
import {
  resolveAtSlotLevel,
  substituteMod,
  resolveCantripDie,
  castSourceFromCharacterSpell,
  getSpellCastability,
  isRitualEligible,
  getEligibleSlotOptions,
  getDefaultSlotOption,
  computeCastEffects,
  type CastSpellSource,
} from "@/lib/spells/casting";
import type { CasterInfo, CharacterSpell } from "@/lib/types/spells";
import type { CharacterState } from "@/lib/types/character";
import type { ActiveEffect } from "@/lib/types/active-effects";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date("2026-07-16T12:00:00.000Z");
const nextId = () => "effect-1";

function mkCasterInfo(overrides: Partial<CasterInfo> = {}): CasterInfo {
  return {
    isCaster: true,
    classes: [
      {
        slug: "wizard",
        level: 3,
        type: "full",
        ability: "intelligence",
        prepared: true,
        cantripsKnown: 3,
        spellsKnown: "all",
        maxPrepared: 6,
        ritualCasting: true,
      },
    ],
    spellDc: 13,
    spellAttackBonus: 5,
    ...overrides,
  };
}

const ABILITY_SCORES = {
  intelligence: 16, // +3
  wisdom: 14, // +2
  charisma: 8, // -1
};

function mkSource(overrides: Partial<CastSpellSource> = {}): CastSpellSource {
  return {
    id: "content-1",
    name: "Burning Hands",
    slug: "burning-hands",
    effects: [],
    data: {
      level: 1,
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      damage: {
        type: "fire",
        dice_at_slot_level: { "1": "3d6", "2": "4d6", "3": "5d6" },
      },
      dc: { type: "dexterity", success: "half" },
    },
    ...overrides,
  };
}

function mkCharacterSpell(
  overrides: Partial<CharacterSpell> = {},
  dataOverrides: Record<string, unknown> = {},
): CharacterSpell {
  return {
    id: "spell-1",
    character_id: "char-1",
    content_id: "content-1",
    name: "Burning Hands",
    class_slug: "wizard",
    is_known: true,
    is_prepared: true,
    always_prepared: false,
    in_spellbook: true,
    source: "selection",
    custom_data: null,
    created_at: FIXED_NOW.toISOString(),
    content_definitions: {
      id: "content-1",
      name: "Burning Hands",
      slug: "burning-hands",
      content_type: "spell",
      data: { level: 1, duration: "Instantaneous", ritual: false, ...dataOverrides },
      effects: [],
    },
    ...overrides,
  } as CharacterSpell;
}

// ---------------------------------------------------------------------------
// resolveAtSlotLevel — breakpoint inheritance
// ---------------------------------------------------------------------------

describe("resolveAtSlotLevel", () => {
  const map = { "3": "8d6", "5": "10d6", "9": "14d6" };

  it("resolves an exact key", () => {
    expect(resolveAtSlotLevel(map, 3)).toBe("8d6");
    expect(resolveAtSlotLevel(map, 5)).toBe("10d6");
  });

  it("inherits the highest defined key at or below the level", () => {
    expect(resolveAtSlotLevel(map, 4)).toBe("8d6");
    expect(resolveAtSlotLevel(map, 8)).toBe("10d6");
  });

  it("returns null below the lowest key or for empty maps", () => {
    expect(resolveAtSlotLevel(map, 2)).toBeNull();
    expect(resolveAtSlotLevel({}, 5)).toBeNull();
    expect(resolveAtSlotLevel(null, 5)).toBeNull();
    expect(resolveAtSlotLevel(undefined, 5)).toBeNull();
  });

  it("resolves cantrip maps keyed by character-level tiers", () => {
    const cantrip = { "1": "1d10", "5": "2d10", "11": "3d10", "17": "4d10" };
    expect(resolveAtSlotLevel(cantrip, 1)).toBe("1d10");
    expect(resolveAtSlotLevel(cantrip, 7)).toBe("2d10");
    expect(resolveAtSlotLevel(cantrip, 20)).toBe("4d10");
  });
});

// ---------------------------------------------------------------------------
// substituteMod
// ---------------------------------------------------------------------------

describe("substituteMod", () => {
  it("substitutes a positive modifier", () => {
    expect(substituteMod("1d8 + MOD", 3)).toBe("1d8 + 3");
  });

  it("normalizes a negative modifier to subtraction", () => {
    expect(substituteMod("1d8 + MOD", -2)).toBe("1d8 - 2");
  });

  it("substitutes zero", () => {
    expect(substituteMod("1d8 + MOD", 0)).toBe("1d8 + 0");
  });

  it("leaves expressions without MOD untouched", () => {
    expect(substituteMod("8d6", 4)).toBe("8d6");
    expect(substituteMod("2d4 + 2", 4)).toBe("2d4 + 2");
  });
});

// ---------------------------------------------------------------------------
// resolveCantripDie
// ---------------------------------------------------------------------------

describe("resolveCantripDie", () => {
  const die = { die: "1d8", levels: [1, 5, 11, 17] };

  it("scales the die count by tiers reached", () => {
    expect(resolveCantripDie(die, 1)).toBe("1d8");
    expect(resolveCantripDie(die, 5)).toBe("2d8");
    expect(resolveCantripDie(die, 11)).toBe("3d8");
    expect(resolveCantripDie(die, 20)).toBe("4d8");
  });

  it("defaults tiers to 1/5/11/17 when levels are absent", () => {
    expect(resolveCantripDie({ die: "1d10" }, 12)).toBe("3d10");
  });

  it("returns null without a parseable die", () => {
    expect(resolveCantripDie(undefined, 5)).toBeNull();
    expect(resolveCantripDie({ die: "banana" }, 5)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// castSourceFromCharacterSpell
// ---------------------------------------------------------------------------

describe("castSourceFromCharacterSpell", () => {
  it("extracts the content definition", () => {
    const source = castSourceFromCharacterSpell(mkCharacterSpell());
    expect(source).toMatchObject({
      id: "content-1",
      name: "Burning Hands",
      slug: "burning-hands",
    });
    expect(source?.data.level).toBe(1);
  });

  it("returns null without content or a numeric level", () => {
    expect(
      castSourceFromCharacterSpell(
        mkCharacterSpell({ content_definitions: null }),
      ),
    ).toBeNull();
    const noLevel = mkCharacterSpell();
    delete (noLevel.content_definitions!.data as Record<string, unknown>).level;
    expect(castSourceFromCharacterSpell(noLevel)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSpellCastability + isRitualEligible
// ---------------------------------------------------------------------------

describe("getSpellCastability", () => {
  const casterInfo = mkCasterInfo();

  it("cantrips are always fully castable", () => {
    const spell = mkCharacterSpell({ is_prepared: false }, { level: 0 });
    expect(getSpellCastability(spell, casterInfo)).toBe("full");
  });

  it("always-prepared spells are fully castable", () => {
    const spell = mkCharacterSpell({ is_prepared: false, always_prepared: true });
    expect(getSpellCastability(spell, casterInfo)).toBe("full");
  });

  it("prepared-caster spells require preparation", () => {
    expect(getSpellCastability(mkCharacterSpell(), casterInfo)).toBe("full");
    expect(
      getSpellCastability(
        mkCharacterSpell({ is_prepared: false, in_spellbook: false }),
        casterInfo,
      ),
    ).toBe("none");
  });

  it("known-caster spells only require being known", () => {
    const bardInfo = mkCasterInfo({
      classes: [
        {
          slug: "bard",
          level: 3,
          type: "full",
          ability: "charisma",
          prepared: false,
          cantripsKnown: 2,
          spellsKnown: 6,
          maxPrepared: 0,
          ritualCasting: true,
        },
      ],
    });
    const spell = mkCharacterSpell({ class_slug: "bard", is_prepared: false });
    expect(getSpellCastability(spell, bardInfo)).toBe("full");
  });

  it("unprepared wizard spellbook rituals are ritual-only (RAW nuance)", () => {
    const spell = mkCharacterSpell(
      { is_prepared: false, in_spellbook: true },
      { ritual: true },
    );
    expect(getSpellCastability(spell, casterInfo)).toBe("ritual-only");
  });

  it("unprepared spellbook non-rituals are not castable", () => {
    const spell = mkCharacterSpell(
      { is_prepared: false, in_spellbook: true },
      { ritual: false },
    );
    expect(getSpellCastability(spell, casterInfo)).toBe("none");
  });

  it("spellbook rituals stay uncastable without class ritual casting", () => {
    const noRitualInfo = mkCasterInfo({
      classes: [{ ...mkCasterInfo().classes[0], ritualCasting: false }],
    });
    const spell = mkCharacterSpell(
      { is_prepared: false, in_spellbook: true },
      { ritual: true },
    );
    expect(getSpellCastability(spell, noRitualInfo)).toBe("none");
  });

  it("rows without content data are not castable", () => {
    const spell = mkCharacterSpell({ content_definitions: null });
    expect(getSpellCastability(spell, casterInfo)).toBe("none");
  });
});

describe("isRitualEligible", () => {
  it("requires the ritual flag and class ritual casting", () => {
    const casterInfo = mkCasterInfo();
    expect(
      isRitualEligible(mkCharacterSpell({}, { ritual: true }), casterInfo),
    ).toBe(true);
    expect(
      isRitualEligible(mkCharacterSpell({}, { ritual: false }), casterInfo),
    ).toBe(false);
    const noRitualInfo = mkCasterInfo({
      classes: [{ ...mkCasterInfo().classes[0], ritualCasting: false }],
    });
    expect(
      isRitualEligible(mkCharacterSpell({}, { ritual: true }), noRitualInfo),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getEligibleSlotOptions
// ---------------------------------------------------------------------------

describe("getEligibleSlotOptions", () => {
  it("offers levels at or above the spell level that the character has", () => {
    const options = getEligibleSlotOptions(
      1,
      { "1": 4, "2": 2 },
      { "1": 1 },
      null,
    );
    expect(options).toEqual([
      { key: "1", castLevel: 1, total: 4, used: 1, free: 3, isPact: false },
      { key: "2", castLevel: 2, total: 2, used: 0, free: 2, isPact: false },
    ]);
  });

  it("excludes levels below the spell level", () => {
    const options = getEligibleSlotOptions(2, { "1": 4, "2": 2 }, {}, null);
    expect(options.map((o) => o.key)).toEqual(["2"]);
  });

  it("offers pact slots as a first-class option at the pact level", () => {
    // Warlock 3 / Wizard 2: caster level 2 → leveled {1:3}; pact 2 at level 2.
    const options = getEligibleSlotOptions(1, { "1": 3, pact: 2 }, { pact: 1 }, 2);
    expect(options).toEqual([
      { key: "1", castLevel: 1, total: 3, used: 0, free: 3, isPact: false },
      { key: "pact", castLevel: 2, total: 2, used: 1, free: 1, isPact: true },
    ]);
  });

  it("excludes pact slots below the spell level", () => {
    const options = getEligibleSlotOptions(3, { "1": 3, pact: 2 }, {}, 2);
    expect(options).toEqual([]);
  });

  it("clamps stale used counts to the slot total", () => {
    const options = getEligibleSlotOptions(1, { "1": 2 }, { "1": 5 }, null);
    expect(options[0]).toMatchObject({ used: 2, free: 0 });
  });
});

describe("getDefaultSlotOption", () => {
  it("picks the lowest option with a free slot", () => {
    const options = getEligibleSlotOptions(
      1,
      { "1": 2, "2": 2 },
      { "1": 2 },
      null,
    );
    expect(getDefaultSlotOption(options)?.key).toBe("2");
  });

  it("returns null when every option is exhausted", () => {
    const options = getEligibleSlotOptions(1, { "1": 2 }, { "1": 2 }, null);
    expect(getDefaultSlotOption(options)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeCastEffects
// ---------------------------------------------------------------------------

function cast(
  source: CastSpellSource,
  choice: Parameters<typeof computeCastEffects>[0]["choice"],
  state: CharacterState = {},
  extras: Partial<Parameters<typeof computeCastEffects>[0]> = {},
) {
  return computeCastEffects({
    spell: source,
    choice,
    state,
    casterInfo: mkCasterInfo(),
    abilityScores: ABILITY_SCORES,
    characterLevel: 3,
    classSlug: "wizard",
    now: FIXED_NOW,
    generateId: nextId,
    ...extras,
  });
}

describe("computeCastEffects", () => {
  it("cantrip: no slot change, damage scaled by character level", () => {
    const fireBolt = mkSource({
      name: "Fire Bolt",
      slug: "fire-bolt",
      data: {
        level: 0,
        duration: "Instantaneous",
        attack_type: "ranged",
        damage: {
          type: "fire",
          dice_at_slot_level: { "1": "1d10", "5": "2d10", "11": "3d10" },
        },
      },
    });
    const outcome = cast(fireBolt, { type: "cantrip" }, {}, { characterLevel: 5 });
    expect(outcome.statePatch).toEqual({});
    expect(outcome.castLevel).toBe(0);
    expect(outcome.rollRequests).toEqual([
      {
        kind: "attack",
        label: "Fire Bolt — Attack",
        expression: "1d20+5",
        meta: { spell_slug: "fire-bolt", slot_level: 0 },
      },
      {
        kind: "damage",
        label: "Fire Bolt — Damage",
        expression: "2d10",
        meta: { spell_slug: "fire-bolt", slot_level: 0, damage_type: "fire" },
      },
    ]);
  });

  it("cantrip fallback: descriptionCantripDie when no damage map exists", () => {
    const cantrip = mkSource({
      name: "Custom Zap",
      slug: "custom-zap",
      data: {
        level: 0,
        duration: "Instantaneous",
        damage: null,
        descriptionCantripDie: { die: "1d6", levels: [1, 5, 11, 17] },
      },
    });
    const outcome = cast(cantrip, { type: "cantrip" }, {}, { characterLevel: 11 });
    expect(outcome.rollRequests).toHaveLength(1);
    expect(outcome.rollRequests[0].expression).toBe("3d6");
  });

  it("consumes a leveled slot preserving other keys", () => {
    const outcome = cast(
      mkSource(),
      { type: "slot", level: 1 },
      { spell_slots_used: { "2": 1 } },
    );
    expect(outcome.statePatch.spell_slots_used).toEqual({ "1": 1, "2": 1 });
    expect(outcome.castLevel).toBe(1);
  });

  it("upcast uses breakpoint inheritance for the damage roll", () => {
    const sparse = mkSource({
      data: {
        level: 1,
        duration: "Instantaneous",
        damage: { type: "fire", dice_at_slot_level: { "1": "3d6", "3": "5d6" } },
      },
    });
    expect(
      cast(sparse, { type: "slot", level: 3 }).rollRequests[0].expression,
    ).toBe("5d6");
    // Level between breakpoints inherits the highest defined key below it.
    expect(
      cast(sparse, { type: "slot", level: 2 }).rollRequests[0].expression,
    ).toBe("3d6");
    expect(
      cast(sparse, { type: "slot", level: 2 }).statePatch.spell_slots_used,
    ).toEqual({ "2": 1 });
  });

  it("consumes the pact key for pact casts", () => {
    const outcome = cast(
      mkSource(),
      { type: "pact", level: 2 },
      { spell_slots_used: { pact: 1 } },
    );
    expect(outcome.statePatch.spell_slots_used).toEqual({ pact: 2 });
    expect(outcome.castLevel).toBe(2);
    // Upcast lookup follows the pact level.
    expect(outcome.rollRequests[0].expression).toBe("4d6");
  });

  it("ritual casts consume no slot and cast at base level", () => {
    const detectMagic = mkSource({
      name: "Detect Magic",
      slug: "detect-magic",
      data: {
        level: 1,
        duration: "Concentration, up to 10 minutes",
        concentration: true,
        ritual: true,
        damage: null,
      },
    });
    const outcome = cast(detectMagic, { type: "ritual" });
    expect(outcome.statePatch.spell_slots_used).toBeUndefined();
    expect(outcome.castLevel).toBe(1);
    // Concentration + duration still apply through the same atomic patch.
    expect(outcome.statePatch.concentrating_on).toMatchObject({
      spell_slug: "detect-magic",
      spell_name: "Detect Magic",
      slot_level: 1,
    });
    expect(outcome.statePatch.active_effects).toHaveLength(1);
    expect(outcome.activeEffect).toMatchObject({
      slug: "detect-magic",
      concentration: true,
      duration: { type: "minutes", value: 10 },
    });
  });

  it("non-instantaneous casts apply an active effect (duration_structured preferred)", () => {
    const mageArmor = mkSource({
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
      ] as never,
      data: {
        level: 1,
        duration: "8 hours",
        duration_structured: { type: "hours", value: 8 },
        concentration: false,
        damage: null,
      },
    });
    const outcome = cast(mageArmor, { type: "slot", level: 1 });
    expect(outcome.statePatch.spell_slots_used).toEqual({ "1": 1 });
    const effects = outcome.statePatch.active_effects as ActiveEffect[];
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      name: "Mage Armor",
      source: "spell",
      concentration: false,
      cast_at_level: 1,
      duration: { type: "hours", value: 8 },
      expires_at: new Date(
        FIXED_NOW.getTime() + 8 * 60 * 60 * 1000,
      ).toISOString(),
    });
    expect(effects[0].effects).toHaveLength(1);
    // Non-concentration cast never touches concentrating_on.
    expect("concentrating_on" in outcome.statePatch).toBe(false);
  });

  it("instantaneous casts add no active effect", () => {
    const outcome = cast(mkSource(), { type: "slot", level: 1 });
    expect(outcome.activeEffect).toBeNull();
    expect("active_effects" in outcome.statePatch).toBe(false);
    expect("concentrating_on" in outcome.statePatch).toBe(false);
  });

  it("replacing concentration strips previous linked effects in the same patch", () => {
    const previousBless: ActiveEffect = {
      id: "bless-1",
      name: "Bless",
      slug: "bless",
      source: "spell",
      content_id: "c-bless",
      effects: [],
      duration: { type: "minutes", value: 1 },
      concentration: true,
      applied_at: FIXED_NOW.toISOString(),
      expires_at: null,
    };
    const mageArmorEntry: ActiveEffect = {
      ...previousBless,
      id: "ma-1",
      name: "Mage Armor",
      slug: "mage-armor",
      concentration: false,
    };
    const state: CharacterState = {
      spell_slots_used: { "1": 1 },
      concentrating_on: {
        spell_slug: "bless",
        spell_name: "Bless",
        slot_level: 1,
        started_at: FIXED_NOW.toISOString(),
      },
      active_effects: [previousBless, mageArmorEntry],
    };
    const shieldOfFaith = mkSource({
      name: "Shield of Faith",
      slug: "shield-of-faith",
      data: {
        level: 1,
        duration: "Concentration, up to 10 minutes",
        concentration: true,
        damage: null,
      },
    });
    const outcome = cast(shieldOfFaith, { type: "slot", level: 2 }, state);

    // ONE patch composes slot + concentration + effects (decision D6).
    expect(outcome.statePatch.spell_slots_used).toEqual({ "1": 1, "2": 1 });
    expect(outcome.statePatch.concentrating_on).toMatchObject({
      spell_slug: "shield-of-faith",
      slot_level: 2,
    });
    const effects = outcome.statePatch.active_effects as ActiveEffect[];
    expect(effects.map((e) => e.slug)).toEqual(["mage-armor", "shield-of-faith"]);
  });

  it("substitutes MOD in heal rolls using the casting class ability", () => {
    const cureWounds = mkSource({
      name: "Cure Wounds",
      slug: "cure-wounds",
      data: {
        level: 1,
        duration: "Instantaneous",
        damage: null,
        dc: null,
        heal_at_slot_level: { "1": "1d8 + MOD", "2": "2d8 + MOD" },
      },
    });
    const clericInfo = mkCasterInfo({
      classes: [
        {
          slug: "cleric",
          level: 3,
          type: "full",
          ability: "wisdom",
          prepared: true,
          cantripsKnown: 3,
          spellsKnown: "all",
          maxPrepared: 5,
          ritualCasting: true,
        },
      ],
    });
    const outcome = cast(cureWounds, { type: "slot", level: 2 }, {}, {
      casterInfo: clericInfo,
      classSlug: "cleric",
    });
    expect(outcome.rollRequests).toEqual([
      {
        kind: "heal",
        label: "Cure Wounds — Healing",
        expression: "2d8 + 2",
        meta: { spell_slug: "cure-wounds", slot_level: 2 },
      },
    ]);
  });

  it("normalizes negative MOD substitutions", () => {
    const cureWounds = mkSource({
      name: "Cure Wounds",
      slug: "cure-wounds",
      data: {
        level: 1,
        duration: "Instantaneous",
        damage: null,
        heal_at_slot_level: { "1": "1d8 + MOD" },
      },
    });
    const weakInfo = mkCasterInfo({
      classes: [{ ...mkCasterInfo().classes[0], ability: "charisma" }],
    });
    const outcome = cast(cureWounds, { type: "slot", level: 1 }, {}, {
      casterInfo: weakInfo,
    });
    expect(outcome.rollRequests[0].expression).toBe("1d8 - 1");
  });

  it("reports save-DC info from the caster's spell DC", () => {
    const outcome = cast(mkSource(), { type: "slot", level: 1 });
    expect(outcome.dcInfo).toEqual({
      ability: "dexterity",
      dc: 13,
      success: "half",
    });
  });

  it("omits attack requests when the spell makes no spell attack", () => {
    const outcome = cast(mkSource(), { type: "slot", level: 1 });
    expect(outcome.rollRequests.map((r) => r.kind)).toEqual(["damage"]);
  });
});
