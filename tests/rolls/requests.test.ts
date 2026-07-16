import { describe, it, expect } from "vitest";
import {
  D20_ROLL_KINDS,
  appendRollModifierDice,
  buildD20RollRequest,
  buildImmediateRollRequest,
  describeD20Roll,
  formatSignedTerm,
  isD20RollKind,
  rollModifierKindFor,
} from "@/lib/rolls/requests";
import type { RollModifier } from "@/lib/types/active-effects";

const bless: RollModifier = { name: "Bless", dice: "1d4" };
const bane: RollModifier = { name: "Bane", dice: "-1d4" };

describe("isD20RollKind / D20_ROLL_KINDS", () => {
  it("classifies popover kinds vs immediate kinds", () => {
    for (const kind of D20_ROLL_KINDS) {
      expect(isD20RollKind(kind)).toBe(true);
    }
    expect(isD20RollKind("damage")).toBe(false);
    expect(isD20RollKind("heal")).toBe(false);
    expect(isD20RollKind("hit_die")).toBe(false);
    expect(isD20RollKind("custom")).toBe(false);
  });
});

describe("rollModifierKindFor", () => {
  it("maps attack rolls to the attack bucket", () => {
    expect(rollModifierKindFor("attack")).toBe("attack");
  });

  it("maps saves, death saves, and concentration to the save bucket (RAW: all are saving throws)", () => {
    expect(rollModifierKindFor("save")).toBe("save");
    expect(rollModifierKindFor("death_save")).toBe("save");
    expect(rollModifierKindFor("concentration")).toBe("save");
  });

  it("maps checks and initiative to the check bucket (RAW: initiative is a DEX check)", () => {
    expect(rollModifierKindFor("check")).toBe("check");
    expect(rollModifierKindFor("initiative")).toBe("check");
  });
});

describe("formatSignedTerm", () => {
  it("formats positive, negative, and zero", () => {
    expect(formatSignedTerm(3)).toBe("+3");
    expect(formatSignedTerm(-1)).toBe("-1");
    expect(formatSignedTerm(0)).toBe("");
  });
});

describe("appendRollModifierDice", () => {
  it("appends positive dice with a plus sign", () => {
    expect(appendRollModifierDice("1d20+5", [bless])).toBe("1d20+5+1d4");
  });

  it("appends negative dice as-is", () => {
    expect(appendRollModifierDice("1d20+5", [bane])).toBe("1d20+5-1d4");
  });

  it("appends multiple riders in order and skips empty dice strings", () => {
    expect(
      appendRollModifierDice("1d20", [bless, { name: "Broken", dice: "  " }, bane]),
    ).toBe("1d20+1d4-1d4");
  });
});

describe("buildD20RollRequest", () => {
  it("builds a plain check: STR 16 → 1d20+3", () => {
    const request = buildD20RollRequest({
      kind: "check",
      label: "Strength Check",
      modifier: 3,
    });
    expect(request).toEqual({
      kind: "check",
      label: "Strength Check",
      expression: "1d20+3",
    });
  });

  it("omits a zero modifier (bare 1d20) — the death-save shape", () => {
    const request = buildD20RollRequest({ kind: "death_save", label: "Death Save" });
    expect(request.expression).toBe("1d20");
  });

  it("keeps negative modifiers", () => {
    const request = buildD20RollRequest({
      kind: "save",
      label: "Strength Save",
      modifier: -1,
    });
    expect(request.expression).toBe("1d20-1");
  });

  it("sets mode for advantage/disadvantage but not for normal", () => {
    expect(
      buildD20RollRequest({ kind: "check", label: "x", modifier: 2, mode: "advantage" })
        .mode,
    ).toBe("advantage");
    expect(
      buildD20RollRequest({
        kind: "check",
        label: "x",
        modifier: 2,
        mode: "disadvantage",
      }).mode,
    ).toBe("disadvantage");
    expect(
      buildD20RollRequest({ kind: "check", label: "x", modifier: 2, mode: "normal" })
        .mode,
    ).toBeUndefined();
  });

  it("appends roll-modifier dice and records them in meta for the breakdown", () => {
    const request = buildD20RollRequest({
      kind: "attack",
      label: "Mace — Attack",
      modifier: 5,
      rollModifiers: [bless],
    });
    expect(request.expression).toBe("1d20+5+1d4");
    expect(request.meta?.roll_modifiers).toEqual([bless]);
  });

  it("merges caller meta with roll modifiers", () => {
    const request = buildD20RollRequest({
      kind: "save",
      label: "DEX Save",
      modifier: 4,
      rollModifiers: [bane],
      meta: { dc: 15 },
    });
    expect(request.meta).toEqual({ dc: 15, roll_modifiers: [bane] });
  });

  it("has no meta when neither riders nor caller meta exist", () => {
    const request = buildD20RollRequest({ kind: "check", label: "x", modifier: 1 });
    expect(request.meta).toBeUndefined();
  });
});

describe("buildImmediateRollRequest", () => {
  it("passes the expression through", () => {
    expect(
      buildImmediateRollRequest({
        kind: "damage",
        label: "Mace — Damage",
        expression: "1d6+3",
      }),
    ).toEqual({ kind: "damage", label: "Mace — Damage", expression: "1d6+3" });
  });

  it("arms crit only when requested", () => {
    const crit = buildImmediateRollRequest({
      kind: "damage",
      label: "x",
      expression: "1d6+3",
      crit: true,
    });
    expect(crit.crit).toBe(true);
    const normal = buildImmediateRollRequest({
      kind: "damage",
      label: "x",
      expression: "1d6+3",
      crit: false,
    });
    expect(normal.crit).toBeUndefined();
  });

  it("carries caller meta", () => {
    const request = buildImmediateRollRequest({
      kind: "damage",
      label: "x",
      expression: "1d6",
      meta: { damage_type: "bludgeoning" },
    });
    expect(request.meta).toEqual({ damage_type: "bludgeoning" });
  });
});

describe("describeD20Roll", () => {
  it("shows the flat bonus", () => {
    expect(describeD20Roll(5)).toBe("1d20+5");
    expect(describeD20Roll(0)).toBe("1d20");
    expect(describeD20Roll(undefined)).toBe("1d20");
  });

  it("names each rider", () => {
    expect(describeD20Roll(5, [bless])).toBe("1d20+5 +1d4 (Bless)");
    expect(describeD20Roll(2, [bless, bane])).toBe("1d20+2 +1d4 (Bless) -1d4 (Bane)");
  });
});
