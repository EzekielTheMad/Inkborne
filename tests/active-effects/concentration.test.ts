import { describe, it, expect } from "vitest";
import type { ActiveEffect } from "@/lib/types/active-effects";
import type { CharacterState } from "@/lib/types/character";
import {
  computeConcentrationDropPatch,
  concentrationSaveDc,
  buildConcentrationSaveRequest,
} from "@/lib/active-effects/concentration";

const mkEffect = (overrides: Partial<ActiveEffect> = {}): ActiveEffect => ({
  id: "e1",
  name: "Mage Armor",
  slug: "mage-armor",
  source: "spell",
  content_id: "content-1",
  effects: [],
  duration: { type: "hours", value: 8 },
  concentration: false,
  applied_at: "2026-07-15T12:00:00.000Z",
  expires_at: "2026-07-15T20:00:00.000Z",
  ...overrides,
});

describe("computeConcentrationDropPatch", () => {
  it("clears concentrating_on and strips only concentration-linked effects in one patch object", () => {
    const state: CharacterState = {
      concentrating_on: {
        spell_slug: "bless",
        spell_name: "Bless",
        slot_level: 1,
        started_at: "2026-07-15T12:00:00.000Z",
      },
      active_effects: [
        mkEffect(), // non-concentration: survives
        mkEffect({ id: "e-bless", name: "Bless", concentration: true }),
        mkEffect({ id: "e-bless-2", name: "Bless (ally)", concentration: true }),
      ],
    };

    const patch = computeConcentrationDropPatch(state);

    // ONE atomic patch: exactly the two concentration keys, nothing else.
    expect(Object.keys(patch).sort()).toEqual([
      "active_effects",
      "concentrating_on",
    ]);
    expect(patch.concentrating_on).toBeNull();
    expect(patch.active_effects?.map((e) => e.id)).toEqual(["e1"]);
  });

  it("does not mutate the input state", () => {
    const effects = [mkEffect({ concentration: true })];
    const state: CharacterState = { active_effects: effects };
    computeConcentrationDropPatch(state);
    expect(state.active_effects).toHaveLength(1);
    expect(effects[0].concentration).toBe(true);
  });

  it("handles missing active_effects (patch still clears concentration)", () => {
    const patch = computeConcentrationDropPatch({});
    expect(patch.concentrating_on).toBeNull();
    expect(patch.active_effects).toEqual([]);
  });

  it("leaves non-concentration effects untouched when nothing is linked", () => {
    const state: CharacterState = {
      active_effects: [mkEffect(), mkEffect({ id: "e2" })],
    };
    const patch = computeConcentrationDropPatch(state);
    expect(patch.active_effects?.map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});

describe("concentrationSaveDc", () => {
  it("is max(10, floor(damage / 2))", () => {
    expect(concentrationSaveDc(14)).toBe(10);
    expect(concentrationSaveDc(22)).toBe(11);
    expect(concentrationSaveDc(47)).toBe(23);
  });

  it("floors at DC 10 for small damage", () => {
    expect(concentrationSaveDc(1)).toBe(10);
    expect(concentrationSaveDc(20)).toBe(10);
    expect(concentrationSaveDc(21)).toBe(10);
  });

  it("scales past the floor at 22+ damage", () => {
    expect(concentrationSaveDc(23)).toBe(11);
    expect(concentrationSaveDc(100)).toBe(50);
  });
});

describe("buildConcentrationSaveRequest", () => {
  it("builds a kind=concentration d20 request with the save modifier", () => {
    const request = buildConcentrationSaveRequest("Bless", 5, {
      damage: 22,
      dc: 11,
    });
    expect(request).toEqual({
      kind: "concentration",
      label: "Concentration Save — Bless",
      expression: "1d20+5",
      meta: { dc: 11, damage: 22 },
    });
  });

  it("formats zero and negative modifiers", () => {
    expect(
      buildConcentrationSaveRequest("Bless", 0, { damage: 14, dc: 10 })
        .expression,
    ).toBe("1d20");
    expect(
      buildConcentrationSaveRequest("Bless", -1, { damage: 14, dc: 10 })
        .expression,
    ).toBe("1d20-1");
  });

  it("appends roll_save riders (a concentration check IS a CON save)", () => {
    const request = buildConcentrationSaveRequest(
      "Bless",
      2,
      { damage: 22, dc: 11 },
      [{ name: "Bless", dice: "1d4" }],
    );
    expect(request.expression).toBe("1d20+2+1d4");
    expect(request.meta).toEqual({
      dc: 11,
      damage: 22,
      roll_modifiers: [{ name: "Bless", dice: "1d4" }],
    });
  });
});
