import { describe, it, expect } from "vitest";
import {
  ARCANE_RECOVERY_SLUG,
  arcaneRecoveryBudget,
  arcaneRecoveryClassLevel,
  computeArcaneRecoveryInfo,
  computeArcaneRecoveryPatch,
  mergeShortRestWithRecovery,
  totalPickedLevels,
  validateArcaneRecoveryPicks,
} from "@/lib/rest/arcane-recovery";
import { computeShortRestEffects } from "@/lib/rest/helpers";
import type { CharacterState } from "@/lib/types/character";
import type { FeatureResource } from "@/lib/types/resources";
import type { MaxSlotsByLevel, SpellSlotsUsed } from "@/lib/types/spells";

const arcaneRecoveryResource = (max = 1): FeatureResource => ({
  slug: ARCANE_RECOVERY_SLUG,
  name: "Arcane Recovery",
  max,
  recovery: "long",
  sourceLabel: "Wizard 1",
  sourceFeatureSlug: ARCANE_RECOVERY_SLUG,
});

const mkRef = (
  slug: string,
  contentType: string,
  data: Record<string, unknown>,
) =>
  ({
    content_definitions: { slug, content_type: contentType, data },
  }) as never;

describe("arcaneRecoveryBudget", () => {
  it("is ⌈wizardLevel / 2⌉", () => {
    expect(arcaneRecoveryBudget(1)).toBe(1);
    expect(arcaneRecoveryBudget(2)).toBe(1);
    expect(arcaneRecoveryBudget(3)).toBe(2);
    expect(arcaneRecoveryBudget(5)).toBe(3);
    expect(arcaneRecoveryBudget(9)).toBe(5);
    expect(arcaneRecoveryBudget(20)).toBe(10);
  });

  it("is 0 for non-wizards and garbage input", () => {
    expect(arcaneRecoveryBudget(0)).toBe(0);
    expect(arcaneRecoveryBudget(-3)).toBe(0);
    expect(arcaneRecoveryBudget(Number.NaN)).toBe(0);
  });
});

describe("arcaneRecoveryClassLevel", () => {
  it("uses wizard levels only in a multiclass", () => {
    const classes = [
      { slug: "fighter", level: 3 },
      { slug: "wizard", level: 5 },
    ];
    expect(arcaneRecoveryClassLevel(classes)).toBe(5);
  });

  it("returns 0 with no wizard levels", () => {
    expect(arcaneRecoveryClassLevel([{ slug: "cleric", level: 9 }])).toBe(0);
    expect(arcaneRecoveryClassLevel([])).toBe(0);
  });

  it("reads the granting class off the feature content ref (data-driven)", () => {
    const classes = [
      { slug: "wizard", level: 2 },
      { slug: "bloodmage", level: 7 },
    ];
    const refs = [
      mkRef("rage", "feature", { class: "barbarian" }),
      mkRef(ARCANE_RECOVERY_SLUG, "feature", { class: "bloodmage" }),
    ];
    expect(arcaneRecoveryClassLevel(classes, refs)).toBe(7);
  });

  it("ignores a non-feature content ref with the same slug", () => {
    const classes = [{ slug: "wizard", level: 4 }];
    const refs = [mkRef(ARCANE_RECOVERY_SLUG, "item", { class: "rogue" })];
    expect(arcaneRecoveryClassLevel(classes, refs)).toBe(4);
  });
});

describe("totalPickedLevels", () => {
  it("sums level × count", () => {
    expect(totalPickedLevels({ "1": 2, "3": 1 })).toBe(5);
    expect(totalPickedLevels({ "2": 2 })).toBe(4);
  });

  it("ignores zero, negative, and non-numeric keys", () => {
    expect(totalPickedLevels({})).toBe(0);
    expect(totalPickedLevels({ "1": 0, "2": -1, pact: 3 })).toBe(0);
  });
});

describe("computeArcaneRecoveryInfo", () => {
  const maxSlots: MaxSlotsByLevel = { "1": 4, "2": 3, "3": 2 };

  const baseArgs = {
    wizardLevel: 5, // budget 3
    resources: [arcaneRecoveryResource()],
    maxSlots,
  };

  it("is available with the resource unspent and spent slots ≤ 5th", () => {
    const info = computeArcaneRecoveryInfo({
      ...baseArgs,
      state: { spell_slots_used: { "1": 2, "2": 1 } } as CharacterState,
    });
    expect(info.available).toBe(true);
    expect(info.budget).toBe(3);
    expect(info.recoverableSlots).toEqual({ "1": 2, "2": 1 });
  });

  it("is unavailable with no wizard levels", () => {
    const info = computeArcaneRecoveryInfo({
      ...baseArgs,
      wizardLevel: 0,
      state: { spell_slots_used: { "1": 2 } } as CharacterState,
    });
    expect(info.available).toBe(false);
    expect(info.budget).toBe(0);
  });

  it("is unavailable when the feature resource is missing", () => {
    const info = computeArcaneRecoveryInfo({
      ...baseArgs,
      resources: [],
      state: { spell_slots_used: { "1": 2 } } as CharacterState,
    });
    expect(info.available).toBe(false);
  });

  it("is unavailable when the feature use is already spent (once per day)", () => {
    const info = computeArcaneRecoveryInfo({
      ...baseArgs,
      state: {
        spell_slots_used: { "1": 2 },
        feature_uses: { [ARCANE_RECOVERY_SLUG]: 1 },
      } as CharacterState,
    });
    expect(info.available).toBe(false);
  });

  it("is unavailable with no spent slots", () => {
    const info = computeArcaneRecoveryInfo({
      ...baseArgs,
      state: { spell_slots_used: { "1": 0 } } as CharacterState,
    });
    expect(info.available).toBe(false);
    expect(info.recoverableSlots).toEqual({});
  });

  it("excludes 6th+ slots and is unavailable when only 6th+ are spent", () => {
    const info = computeArcaneRecoveryInfo({
      wizardLevel: 20, // budget 10
      resources: [arcaneRecoveryResource()],
      maxSlots: { "5": 2, "6": 1, "7": 1 },
      state: { spell_slots_used: { "6": 1, "7": 1 } } as CharacterState,
    });
    expect(info.recoverableSlots).toEqual({});
    expect(info.available).toBe(false);
  });

  it("is unavailable when every spent level exceeds the budget", () => {
    // Wizard 2 / Cleric 5 multiclass: budget 1, but only a 3rd-level slot spent.
    const info = computeArcaneRecoveryInfo({
      wizardLevel: 2,
      resources: [arcaneRecoveryResource()],
      maxSlots: { "1": 4, "2": 3, "3": 2 },
      state: { spell_slots_used: { "3": 1 } } as CharacterState,
    });
    expect(info.budget).toBe(1);
    expect(info.recoverableSlots).toEqual({ "3": 1 });
    expect(info.available).toBe(false);
  });

  it("clamps spent counts to the level's max (self-healing read)", () => {
    const info = computeArcaneRecoveryInfo({
      ...baseArgs,
      state: { spell_slots_used: { "1": 99 } } as CharacterState,
    });
    expect(info.recoverableSlots).toEqual({ "1": 4 });
  });
});

describe("validateArcaneRecoveryPicks", () => {
  const maxSlots: MaxSlotsByLevel = { "1": 4, "2": 3, "3": 3, "6": 1 };
  const slotState: SpellSlotsUsed = { "1": 2, "2": 1, "3": 2, "6": 1, pact: 1 };

  it("accepts picks within budget against spent slots", () => {
    expect(
      validateArcaneRecoveryPicks({ "1": 1, "2": 1 }, 3, maxSlots, slotState),
    ).toEqual({ valid: true });
  });

  it("accepts empty picks", () => {
    expect(validateArcaneRecoveryPicks({}, 3, maxSlots, slotState)).toEqual({
      valid: true,
    });
  });

  it("rejects picks over budget", () => {
    const result = validateArcaneRecoveryPicks(
      { "3": 2 }, // 6 combined levels
      5,
      maxSlots,
      slotState,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects 6th-level-or-higher slots even when spent and within budget", () => {
    const result = validateArcaneRecoveryPicks({ "6": 1 }, 10, maxSlots, slotState);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.reason).toMatch(/6th level/i);
  });

  it("rejects non-leveled slot keys (pact)", () => {
    const result = validateArcaneRecoveryPicks({ pact: 1 }, 5, maxSlots, slotState);
    expect(result.valid).toBe(false);
  });

  it("rejects restoring more slots than are spent", () => {
    const result = validateArcaneRecoveryPicks({ "2": 2 }, 5, maxSlots, slotState);
    expect(result.valid).toBe(false);
  });

  it("rejects negative and fractional counts", () => {
    expect(
      validateArcaneRecoveryPicks({ "1": -1 }, 5, maxSlots, slotState).valid,
    ).toBe(false);
    expect(
      validateArcaneRecoveryPicks({ "1": 1.5 }, 5, maxSlots, slotState).valid,
    ).toBe(false);
  });
});

describe("computeArcaneRecoveryPatch", () => {
  it("restores exactly the picked keys and spends the feature use", () => {
    const state: CharacterState = {
      spell_slots_used: { "1": 2, "2": 1, "3": 1, pact: 1 },
      feature_uses: { rage: 1 },
    };
    const patch = computeArcaneRecoveryPatch(state, { "1": 1, "2": 1 });
    expect(patch).toEqual({
      spell_slots_used: { "1": 1, "2": 0, "3": 1, pact: 1 },
      feature_uses: { rage: 1, [ARCANE_RECOVERY_SLUG]: 1 },
    });
  });

  it("floors restored slots at 0", () => {
    const state: CharacterState = { spell_slots_used: { "1": 1 } };
    const patch = computeArcaneRecoveryPatch(state, { "1": 3 });
    expect(patch.spell_slots_used).toEqual({ "1": 0 });
  });

  it("returns {} for empty picks — the resource is never touched", () => {
    const state: CharacterState = {
      spell_slots_used: { "1": 2 },
      feature_uses: {},
    };
    expect(computeArcaneRecoveryPatch(state, {})).toEqual({});
    expect(computeArcaneRecoveryPatch(state, { "1": 0 })).toEqual({});
  });

  it("does not mutate the input state", () => {
    const state: CharacterState = {
      spell_slots_used: { "1": 2 },
      feature_uses: {},
    };
    computeArcaneRecoveryPatch(state, { "1": 1 });
    expect(state.spell_slots_used).toEqual({ "1": 2 });
    expect(state.feature_uses).toEqual({});
  });
});

describe("mergeShortRestWithRecovery — patch atomicity", () => {
  const kiResource: FeatureResource = {
    slug: "ki",
    name: "Ki",
    max: 5,
    recovery: "short",
    sourceLabel: "Monk 5",
    sourceFeatureSlug: "ki",
  };

  it("folds recovery into the rest patch as ONE combined object", () => {
    // Wizard/Warlock/Monk chimera to exercise every overlapping map at once:
    // pact reset + slot restoration in spell_slots_used, ki reset + arcane
    // recovery spend in feature_uses.
    const state: CharacterState = {
      spell_slots_used: { "1": 2, "2": 1, pact: 2 },
      feature_uses: { ki: 3 },
    };
    const rest = computeShortRestEffects(state, [kiResource]);
    const patch = mergeShortRestWithRecovery(state, rest.statePatch, {
      "1": 1,
      "2": 1,
    });

    expect(patch).toEqual({
      spell_slots_used: { "1": 1, "2": 0, pact: 0 },
      feature_uses: { ki: 0, [ARCANE_RECOVERY_SLUG]: 1 },
    });
  });

  it("preserves the recovery when the rest patch itself is empty", () => {
    // A wizard with nothing else to recover: short rest exists purely to
    // apply Arcane Recovery.
    const state: CharacterState = { spell_slots_used: { "1": 2 } };
    const rest = computeShortRestEffects(state, []);
    expect(rest.canApply).toBe(false);

    const patch = mergeShortRestWithRecovery(state, rest.statePatch, { "1": 2 });
    expect(patch).toEqual({
      spell_slots_used: { "1": 0 },
      feature_uses: { [ARCANE_RECOVERY_SLUG]: 1 },
    });
  });

  it("passes the rest patch through untouched with no effective picks", () => {
    const state: CharacterState = {
      spell_slots_used: { pact: 1 },
      feature_uses: {},
    };
    const rest = computeShortRestEffects(state, []);
    const patch = mergeShortRestWithRecovery(state, rest.statePatch, {});
    expect(patch).toBe(rest.statePatch);
    expect(patch.feature_uses).toBeUndefined();
  });
});
