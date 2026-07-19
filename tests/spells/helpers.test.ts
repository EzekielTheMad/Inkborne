import { describe, it, expect } from "vitest";
import {
  computeSpellDc,
  computeSpellAttackBonus,
  computeMaxPrepared,
  computeCasterLevel,
  computePactSlotLevel,
  resolveFeatureGrantedSpells,
} from "@/lib/spells/helpers";
import type { CasterClass } from "@/lib/types/spells";

function makeCasterClass(overrides: Partial<CasterClass> = {}): CasterClass {
  return {
    slug: "wizard",
    level: 1,
    type: "full",
    ability: "intelligence",
    prepared: true,
    cantripsKnown: 3,
    spellsKnown: "all",
    maxPrepared: 4,
    ritualCasting: true,
    ...overrides,
  };
}

describe("computeSpellDc", () => {
  it("returns 8 + prof + ability mod", () => {
    // INT 16, prof +2 → DC = 8 + 2 + 3 = 13
    const caster = makeCasterClass({ ability: "intelligence" });
    expect(computeSpellDc(caster, { intelligence: 16 }, 2)).toBe(13);
  });

  it("handles low ability scores", () => {
    // INT 10, prof +2 → DC = 8 + 2 + 0 = 10
    const caster = makeCasterClass();
    expect(computeSpellDc(caster, { intelligence: 10 }, 2)).toBe(10);
  });

  it("handles high-level caster", () => {
    // INT 20, prof +6 (L17+) → DC = 8 + 6 + 5 = 19
    const caster = makeCasterClass();
    expect(computeSpellDc(caster, { intelligence: 20 }, 6)).toBe(19);
  });

  it("uses the caster's ability, not a fixed one", () => {
    // Cleric with WIS 14, prof +3 → DC = 8 + 3 + 2 = 13
    const cleric = makeCasterClass({ slug: "cleric", ability: "wisdom" });
    expect(computeSpellDc(cleric, { wisdom: 14, intelligence: 10 }, 3)).toBe(13);
  });
});

describe("computeSpellAttackBonus", () => {
  it("returns prof + ability mod", () => {
    // INT 16, prof +2 → attack = +5
    const caster = makeCasterClass();
    expect(computeSpellAttackBonus(caster, { intelligence: 16 }, 2)).toBe(5);
  });

  it("handles low prof bonus", () => {
    const caster = makeCasterClass();
    expect(computeSpellAttackBonus(caster, { intelligence: 14 }, 2)).toBe(4);
  });
});

describe("computeMaxPrepared", () => {
  it("cleric: ability mod + class level, minimum 1", () => {
    // WIS mod +3, Cleric L5 → 8 prepared
    expect(computeMaxPrepared("cleric", 5, 3)).toBe(8);
  });

  it("wizard: ability mod + class level, minimum 1", () => {
    // INT mod +4, Wizard L3 → 7 prepared
    expect(computeMaxPrepared("wizard", 3, 4)).toBe(7);
  });

  it("druid: ability mod + class level, minimum 1", () => {
    expect(computeMaxPrepared("druid", 10, 5)).toBe(15);
  });

  it("paladin: ability mod + floor(level/2), minimum 1", () => {
    // CHA mod +3, Paladin L5 → 3 + 2 = 5
    expect(computeMaxPrepared("paladin", 5, 3)).toBe(5);
  });

  it("paladin at L2 with low CHA: min 1", () => {
    // CHA mod +0, Paladin L2 → 0 + 1 = 1, min 1
    expect(computeMaxPrepared("paladin", 2, 0)).toBe(1);
  });

  it("paladin at L1 uses floor(1/2) = 0, min 1", () => {
    // Paladins get no prepared at L1 but we use min 1 as a floor
    expect(computeMaxPrepared("paladin", 1, 3)).toBe(3);
  });

  it("clamps to minimum 1 even for negative ability mods", () => {
    expect(computeMaxPrepared("cleric", 1, -2)).toBe(1);
  });
});

describe("computeCasterLevel", () => {
  it("full casters contribute full level", () => {
    // Wizard 5 → caster level 5
    expect(computeCasterLevel([
      { slug: "wizard", level: 5, type: "full" },
    ])).toBe(5);
  });

  it("half casters contribute floor(level/2) when level >= 2", () => {
    // Paladin 4 → 2
    expect(computeCasterLevel([
      { slug: "paladin", level: 4, type: "half" },
    ])).toBe(2);
  });

  it("half casters contribute 0 at level 1", () => {
    // Paladin 1 → 0 (no spells at L1)
    expect(computeCasterLevel([
      { slug: "paladin", level: 1, type: "half" },
    ])).toBe(0);
  });

  it("warlock does NOT contribute to multiclass caster level", () => {
    // Warlock 5 alone → 0 (pact is separate)
    expect(computeCasterLevel([
      { slug: "warlock", level: 5, type: "pact" },
    ])).toBe(0);
  });

  it("combines multiple casters correctly", () => {
    // Cleric 3 + Wizard 3 → 6
    expect(computeCasterLevel([
      { slug: "cleric", level: 3, type: "full" },
      { slug: "wizard", level: 3, type: "full" },
    ])).toBe(6);
  });

  it("combines full + half correctly", () => {
    // Cleric 3 + Paladin 4 → 3 + 2 = 5
    expect(computeCasterLevel([
      { slug: "cleric", level: 3, type: "full" },
      { slug: "paladin", level: 4, type: "half" },
    ])).toBe(5);
  });

  it("excludes non-casters (type null)", () => {
    // Cleric 3 + Fighter 2 → 3
    expect(computeCasterLevel([
      { slug: "cleric", level: 3, type: "full" },
      { slug: "fighter", level: 2, type: null as unknown as "full" },
    ])).toBe(3);
  });
});

describe("resolveFeatureGrantedSpells", () => {
  it("returns empty when no subclass spellcastingExtra", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "wizard", level: 3, subclass: "evocation" }],
      { evocation: { spellcastingExtra: null } },
    );
    expect(result).toEqual([]);
  });

  it("resolves tier spells at or below class level", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 3, subclass: "life" }],
      {
        life: {
          spellcastingExtra: [
            { level: 1, spells: ["bless", "cure-wounds"] },
            { level: 3, spells: ["lesser-restoration", "spiritual-weapon"] },
            { level: 5, spells: ["beacon-of-hope", "revivify"] },
          ],
        },
      },
    );
    expect(result).toEqual([
      { spell_slug: "bless", class_slug: "cleric" },
      { spell_slug: "cure-wounds", class_slug: "cleric" },
      { spell_slug: "lesser-restoration", class_slug: "cleric" },
      { spell_slug: "spiritual-weapon", class_slug: "cleric" },
    ]);
  });

  it("excludes tiers above class level", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 4, subclass: "life" }],
      {
        life: {
          spellcastingExtra: [
            { level: 1, spells: ["bless"] },
            { level: 5, spells: ["revivify"] },
          ],
        },
      },
    );
    expect(result).toEqual([{ spell_slug: "bless", class_slug: "cleric" }]);
  });

  it("handles multiple classes", () => {
    const result = resolveFeatureGrantedSpells(
      [
        { slug: "cleric", level: 3, subclass: "life" },
        { slug: "paladin", level: 5, subclass: "devotion" },
      ],
      {
        life: { spellcastingExtra: [{ level: 1, spells: ["bless"] }] },
        devotion: {
          spellcastingExtra: [
            { level: 3, spells: ["sanctuary"] },
            { level: 5, spells: ["zone-of-truth"] },
          ],
        },
      },
    );
    expect(result).toEqual([
      { spell_slug: "bless", class_slug: "cleric" },
      { spell_slug: "sanctuary", class_slug: "paladin" },
      { spell_slug: "zone-of-truth", class_slug: "paladin" },
    ]);
  });

  it("handles missing subclass data gracefully", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 3, subclass: "life" }],
      {},
    );
    expect(result).toEqual([]);
  });

  it("skips classes without a subclass", () => {
    const result = resolveFeatureGrantedSpells(
      [{ slug: "cleric", level: 3, subclass: undefined }],
      { life: { spellcastingExtra: [{ level: 1, spells: ["bless"] }] } },
    );
    expect(result).toEqual([]);
  });
});

describe("computePactSlotLevel", () => {
  const warlockData = (pactLevel: number, count: number, atLevel: number) => {
    const levels = Array.from({ length: 20 }, () => ({
      spellcasting: { spell_slots: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
    }));
    levels[atLevel - 1] = {
      spellcasting: {
        spell_slots: Array.from({ length: 9 }, (_, i) =>
          i === pactLevel - 1 ? count : 0,
        ),
      },
    };
    return { warlock: { levels } };
  };

  it("returns the slot level pact slots share", () => {
    expect(
      computePactSlotLevel([{ slug: "warlock", level: 3 }], warlockData(2, 2, 3)),
    ).toBe(2);
  });

  it("returns null without warlock levels", () => {
    expect(computePactSlotLevel([{ slug: "wizard", level: 5 }], {})).toBeNull();
  });

  it("returns null when the warlock row has no slot data", () => {
    expect(
      computePactSlotLevel([{ slug: "warlock", level: 1 }], { warlock: {} }),
    ).toBeNull();
  });

  it("returns null when every slot count is zero", () => {
    expect(
      computePactSlotLevel([{ slug: "warlock", level: 3 }], warlockData(2, 0, 3)),
    ).toBeNull();
  });
});
