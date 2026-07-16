import { describe, it, expect } from "vitest";
import {
  computeShortRestEffects,
  computeLongRestEffects,
} from "@/lib/rest/helpers";
import type { CharacterState } from "@/lib/types/character";
import type { FeatureResource } from "@/lib/types/resources";
import type { HitDicePool } from "@/lib/hit-dice/helpers";

const mkPool = (
  classSlug: string,
  die: number,
  max: number,
  spent: number,
): HitDicePool => ({ classSlug, die, max, spent });

const mkResource = (
  slug: string,
  recovery: "short" | "long",
): FeatureResource => ({
  slug,
  name: slug,
  max: 3,
  recovery,
  sourceLabel: "",
  sourceFeatureSlug: slug,
});

describe("computeShortRestEffects", () => {
  it("canApply=false with no pact slot and no short-rest resources", () => {
    const state: CharacterState = {};
    const result = computeShortRestEffects(state, []);
    expect(result.canApply).toBe(false);
  });

  it("canApply=false when pact slot exists but is not used", () => {
    const state: CharacterState = { spell_slots_used: { pact: 0 } };
    const result = computeShortRestEffects(state, []);
    expect(result.canApply).toBe(false);
  });

  it("zeroes pact slot when it has been used", () => {
    const state: CharacterState = {
      spell_slots_used: { pact: 2, "1": 1 },
    };
    const result = computeShortRestEffects(state, []);
    expect(result.canApply).toBe(true);
    expect(result.statePatch.spell_slots_used).toEqual({ pact: 0, "1": 1 });
  });

  it("zeroes short-rest feature uses but leaves long-rest uses alone", () => {
    const state: CharacterState = {
      feature_uses: { ki: 3, rage: 1, channel_divinity: 1 },
    };
    const resources = [
      mkResource("ki", "short"),
      mkResource("channel_divinity", "short"),
      mkResource("rage", "long"),
    ];
    const result = computeShortRestEffects(state, resources);
    expect(result.canApply).toBe(true);
    expect(result.statePatch.feature_uses).toEqual({
      ki: 0,
      rage: 1,
      channel_divinity: 0,
    });
  });

  it("does not touch HP, death saves, or exhaustion", () => {
    const state: CharacterState = {
      current_hp: 10,
      death_saves: { successes: 1, failures: 2 },
      exhaustion: 3,
      spell_slots_used: { pact: 1 },
    };
    const result = computeShortRestEffects(state, []);
    expect(result.statePatch.current_hp).toBeUndefined();
    expect(result.statePatch.death_saves).toBeUndefined();
    expect(result.statePatch.exhaustion).toBeUndefined();
  });

  it("leaves active effects alone (buffs persist through an hour RAW)", () => {
    const state: CharacterState = {
      spell_slots_used: { pact: 1 },
      active_effects: [{ id: "e1", name: "Mage Armor" } as never],
    };
    const result = computeShortRestEffects(state, []);
    expect(result.statePatch.active_effects).toBeUndefined();
  });
});

describe("computeLongRestEffects", () => {
  it("sets HP to max and clears temp HP", () => {
    const state: CharacterState = { current_hp: 10, temp_hp: 5 };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.current_hp).toBe(50);
    expect(result.statePatch.temp_hp).toBe(0);
  });

  it("clears death saves", () => {
    const state: CharacterState = {
      current_hp: 0,
      death_saves: { successes: 2, failures: 1 },
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.death_saves).toEqual({ successes: 0, failures: 0 });
  });

  it("decrements exhaustion, clamped at 0", () => {
    expect(
      computeLongRestEffects({ exhaustion: 3 }, 50, []).statePatch.exhaustion,
    ).toBe(2);
    expect(
      computeLongRestEffects({ exhaustion: 0 }, 50, []).statePatch.exhaustion,
    ).toBe(0);
    expect(
      computeLongRestEffects({}, 50, []).statePatch.exhaustion,
    ).toBe(0);
  });

  it("clears concentration", () => {
    const state: CharacterState = {
      concentrating_on: { spellId: "bless", hash: "x" } as never,
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.concentrating_on).toBeNull();
  });

  it("zeroes ALL spell_slots_used keys (including pact)", () => {
    const state: CharacterState = {
      spell_slots_used: { "1": 4, "2": 2, "3": 1, pact: 2 },
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.spell_slots_used).toEqual({
      "1": 0,
      "2": 0,
      "3": 0,
      pact: 0,
    });
  });

  it("zeroes feature_uses for both short + long recovery resources", () => {
    const state: CharacterState = {
      feature_uses: { ki: 3, rage: 1, lay_on_hands: 15 },
    };
    const resources = [
      mkResource("ki", "short"),
      mkResource("rage", "long"),
      mkResource("lay_on_hands", "long"),
    ];
    const result = computeLongRestEffects(state, 50, resources);
    expect(result.statePatch.feature_uses).toEqual({
      ki: 0,
      rage: 0,
      lay_on_hands: 0,
    });
  });

  it("clears all active effects", () => {
    const state: CharacterState = {
      active_effects: [
        { id: "e1", name: "Mage Armor" } as never,
        { id: "e2", name: "Bless" } as never,
      ],
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.statePatch.active_effects).toEqual([]);
  });

  it("canApply=true when only active effects are present", () => {
    const state: CharacterState = {
      current_hp: 50,
      temp_hp: 0,
      death_saves: { successes: 0, failures: 0 },
      exhaustion: 0,
      concentrating_on: null,
      spell_slots_used: {},
      feature_uses: {},
      active_effects: [{ id: "e1", name: "Mage Armor" } as never],
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.canApply).toBe(true);
  });

  it("canApply=false when fully rested with no resources used", () => {
    const state: CharacterState = {
      current_hp: 50,
      temp_hp: 0,
      death_saves: { successes: 0, failures: 0 },
      exhaustion: 0,
      concentrating_on: null,
      spell_slots_used: {},
      feature_uses: {},
    };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.canApply).toBe(false);
  });

  it("canApply=true when HP below max", () => {
    const state: CharacterState = { current_hp: 10 };
    const result = computeLongRestEffects(state, 50, []);
    expect(result.canApply).toBe(true);
  });
});

describe("computeLongRestEffects — hit dice recovery", () => {
  const restedState: CharacterState = {
    current_hp: 50,
    temp_hp: 0,
    death_saves: { successes: 0, failures: 0 },
    exhaustion: 0,
    concentrating_on: null,
    spell_slots_used: {},
    feature_uses: {},
  };

  it("recovers ⌊total/2⌋ dice, largest die first (Fighter 3/Wizard 2, all spent)", () => {
    const state: CharacterState = {
      ...restedState,
      hit_dice_spent: { fighter: 3, wizard: 2 },
    };
    const pools = [mkPool("fighter", 10, 3, 3), mkPool("wizard", 6, 2, 2)];
    const result = computeLongRestEffects(state, 50, [], pools);
    // Budget ⌊5/2⌋ = 2, both restored from the d10 pool.
    expect(result.statePatch.hit_dice_spent).toEqual({ fighter: 1, wizard: 2 });
  });

  it("applies the min-1 floor for a level-1 character", () => {
    const state: CharacterState = {
      ...restedState,
      hit_dice_spent: { wizard: 1 },
    };
    const pools = [mkPool("wizard", 6, 1, 1)];
    const result = computeLongRestEffects(state, 50, [], pools);
    expect(result.statePatch.hit_dice_spent).toEqual({ wizard: 0 });
  });

  it("canApply=true when the ONLY change is spent hit dice", () => {
    const pools = [mkPool("fighter", 10, 3, 1)];
    const result = computeLongRestEffects(
      { ...restedState, hit_dice_spent: { fighter: 1 } },
      50,
      [],
      pools,
    );
    expect(result.canApply).toBe(true);
  });

  it("omits hit_dice_spent from the patch when nothing is spent", () => {
    const pools = [mkPool("fighter", 10, 3, 0), mkPool("wizard", 6, 2, 0)];
    const result = computeLongRestEffects(restedState, 50, [], pools);
    expect(result.statePatch).not.toHaveProperty("hit_dice_spent");
    expect(result.canApply).toBe(false);
  });

  it("omits hit_dice_spent when called without pools (legacy callers untouched)", () => {
    const result = computeLongRestEffects(
      { ...restedState, hit_dice_spent: { fighter: 2 } },
      50,
      [],
    );
    expect(result.statePatch).not.toHaveProperty("hit_dice_spent");
  });

  it("rebuilds the spent map from pools, self-healing stale class keys away", () => {
    const state: CharacterState = {
      ...restedState,
      // "sorcerer" no longer among the character's classes.
      hit_dice_spent: { fighter: 2, sorcerer: 3 },
    };
    const pools = [mkPool("fighter", 10, 3, 2)];
    const result = computeLongRestEffects(state, 50, [], pools);
    // Budget ⌊3/2⌋ = 1 recovers one die; the stale "sorcerer" key is gone.
    expect(result.statePatch.hit_dice_spent).toEqual({ fighter: 1 });
  });
});
