import { describe, it, expect } from "vitest";
import { getMultiClassSlots } from "@/lib/spells/multiclass-slots";

describe("getMultiClassSlots", () => {
  it("returns empty object for level 0", () => {
    expect(getMultiClassSlots(0)).toEqual({});
  });

  it("returns level 1 slots for caster level 1", () => {
    expect(getMultiClassSlots(1)).toEqual({ "1": 2 });
  });

  it("returns level 3 slots correctly for caster level 3", () => {
    expect(getMultiClassSlots(3)).toEqual({ "1": 4, "2": 2 });
  });

  it("returns level 5 slots correctly for caster level 5", () => {
    expect(getMultiClassSlots(5)).toEqual({ "1": 4, "2": 3, "3": 2 });
  });

  it("returns level 9 slots correctly for caster level 9", () => {
    expect(getMultiClassSlots(9)).toEqual({ "1": 4, "2": 3, "3": 3, "4": 3, "5": 1 });
  });

  it("returns level 20 slots correctly for caster level 20", () => {
    expect(getMultiClassSlots(20)).toEqual({
      "1": 4, "2": 3, "3": 3, "4": 3, "5": 3,
      "6": 2, "7": 2, "8": 1, "9": 1,
    });
  });

  it("clamps levels above 20 to level 20", () => {
    expect(getMultiClassSlots(25)).toEqual(getMultiClassSlots(20));
  });

  it("returns empty object for negative levels", () => {
    expect(getMultiClassSlots(-1)).toEqual({});
  });
});
