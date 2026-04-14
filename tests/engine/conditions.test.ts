import { describe, it, expect } from "vitest";
import { checkCondition } from "@/lib/engine/conditions";
import type { StateCondition } from "@/lib/types/effects";

describe("checkCondition", () => {
  it("returns true when no condition is provided", () => {
    expect(checkCondition(undefined, {})).toBe(true);
  });

  it("checks eq operator", () => {
    const condition: StateCondition = { field: "equipped_armor", op: "eq", value: "none" };
    expect(checkCondition(condition, { equipped_armor: "none" })).toBe(true);
    expect(checkCondition(condition, { equipped_armor: "heavy" })).toBe(false);
  });

  it("checks neq operator", () => {
    const condition: StateCondition = { field: "equipped_armor", op: "neq", value: "heavy" };
    expect(checkCondition(condition, { equipped_armor: "light" })).toBe(true);
    expect(checkCondition(condition, { equipped_armor: "heavy" })).toBe(false);
  });

  it("checks boolean values", () => {
    const condition: StateCondition = { field: "shield_equipped", op: "eq", value: false };
    expect(checkCondition(condition, { shield_equipped: false })).toBe(true);
    expect(checkCondition(condition, { shield_equipped: true })).toBe(false);
  });

  it("uses defaults for missing fields", () => {
    const condition: StateCondition = { field: "equipped_armor", op: "eq", value: "none" };
    expect(checkCondition(condition, {})).toBe(true);

    const shieldCondition: StateCondition = { field: "shield_equipped", op: "eq", value: false };
    expect(checkCondition(shieldCondition, {})).toBe(true);
  });

  it("handles array conditions with AND semantics", () => {
    const conditions: StateCondition[] = [
      { field: "equipped_armor", op: "eq", value: "none" },
      { field: "shield_equipped", op: "eq", value: false },
    ];
    expect(checkCondition(conditions, { equipped_armor: "none", shield_equipped: false })).toBe(true);
    expect(checkCondition(conditions, { equipped_armor: "none", shield_equipped: true })).toBe(false);
    expect(checkCondition(conditions, { equipped_armor: "light", shield_equipped: false })).toBe(false);
  });

  it("checks rage_active boolean", () => {
    const condition: StateCondition = { field: "rage_active", op: "eq", value: true };
    expect(checkCondition(condition, { rage_active: true })).toBe(true);
    expect(checkCondition(condition, {})).toBe(false);
  });
});
