import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import { collectActiveEffects } from "@/lib/active-effects/helpers";
import { resolveSavingThrowBonus, resolveSavingThrowModifier, getSaveModifier } from "@/lib/sheet/helpers";
import { getConfirmedAbilityModifier } from "@/lib/character/ability-mechanics";
import type { Effect } from "@/lib/types/effects";
import { saveBonusFixture as canonicalFixture } from "../../fixtures/save-bonus-consumers";

function saveBonusFixture(...args: Parameters<typeof canonicalFixture>) {
  const f = canonicalFixture(...args), bonus = resolveSavingThrowBonus(f.result, f.schema, f.effects);
  const savingThrow = resolveSavingThrowModifier(getConfirmedAbilityModifier(f.result, f.schema, "constitution"),
    f.result.computed.proficiency_bonus, f.result.grants, "saving_throw_constitution", bonus);
  return { ...f, bonus, savingThrow };
}

describe("actual producer/evaluator saving throw bonus admission", () => {
  it("consumes a custom-produced +1 exactly once; retains the old omission counterexample", () => {
    const f = saveBonusFixture(), before = structuredClone(f.effects);
    expect(f.current.version).toBe(3); expect(f.pin.version).toBe(3);
    expect(f.result.stats.saving_throw_bonus).toBe(1);
    expect(getSaveModifier(2, 2, f.result.grants, "saving_throw_constitution")).toBe(4);
    expect(f.savingThrow).toMatchObject({ status: "available", modifier: 5, proficient: true });
    expect(f.effects).toEqual(before);
  });
  it.each([null, 0, -1, 2])("preserves absent/zero/negative aggregate (%s)", value => {
    const f = saveBonusFixture([], value);
    expect(f.savingThrow).toMatchObject({ status: "available", modifier: 4 + (value ?? 0) });
  });
  it("does not require or add proficiency twice and never aliases legacy save_", () => {
    const untrained = saveBonusFixture([], 1, false);
    expect(untrained.savingThrow).toMatchObject({ modifier: 3, proficient: false });
    const f = saveBonusFixture([{ type: "grant", stat: "save_constitution", value: "proficient" }], 1, false);
    expect(f.savingThrow).toMatchObject({ modifier: 3, proficient: false });
  });
  it("consumes two independent equal adds through evaluate without helper resumming", () => {
    const f = saveBonusFixture([{ type: "mechanical", stat: "saving_throw_bonus", op: "add", value: 1 }]);
    expect(f.result.stats.saving_throw_bonus).toBe(2); expect(f.savingThrow).toMatchObject({ modifier: 6 });
  });
  it("preserves condition false absence and the saved-state true contribution", () => {
    const f = saveBonusFixture([{ type: "mechanical", stat: "saving_throw_bonus", op: "add", value: 1,
      condition: { field: "rage_active", op: "eq", value: true } }], null);
    expect(f.result.stats).not.toHaveProperty("saving_throw_bonus"); expect(f.bonus).toEqual({ status: "available", bonus: 0 });
    const result = evaluate(f.base, f.effects, f.schema, f.sources, { ...f.state, rage_active: true });
    expect(resolveSavingThrowBonus(result, f.schema, f.effects)).toEqual({ status: "available", bonus: 1 });
  });
  it("uses actual active expiry collection instead of counting an expired snapshot", () => {
    const f = saveBonusFixture(); f.state.active_effects![0].expires_at = "2020-01-01T00:00:00.000Z";
    const effects = [...f.contentEffects, ...collectActiveEffects(f.state.active_effects)];
    expect(resolveSavingThrowBonus(evaluate(f.base, effects, f.schema, f.sources, f.state as Record<string, unknown>), f.schema, effects))
      .toEqual({ status: "available", bonus: 0 });
  });
  it("uses operation priority/fractional intermediate and formula-last output without rerunning", () => {
    const f = saveBonusFixture([
      { type: "mechanical", stat: "saving_throw_bonus", op: "set", value: 2 },
      { type: "mechanical", stat: "saving_throw_bonus", op: "multiply", value: 0.5 },
    ], null);
    expect(f.bonus).toEqual({ status: "available", bonus: 1 });
    const formula = saveBonusFixture([{ type: "mechanical", stat: "saving_throw_bonus", op: "formula", expr: "3" }]);
    expect(formula.bonus).toEqual({ status: "available", bonus: 3 });
    expect(formula.savingThrow).toMatchObject({ modifier: 7 });
  });
  it.each([null, 1])("rejects a real +1 ac_formula routing conflict even with existing bonus (%s)", active => {
    const f = saveBonusFixture([{ type: "mechanical", stat: "saving_throw_bonus", op: "formula", expr: "1", tag: "ac_formula" }], active);
    const original = structuredClone(f.effects);
    expect(f.result.stats.saving_throw_bonus).toBe(active === null ? undefined : 1);
    expect(f.bonus).toMatchObject({ status: "unavailable" });
    expect(f.result.computed.armor_class).toBe(11);
    expect(resolveSavingThrowBonus(f.result, f.schema, f.effects)).toMatchObject({ status: "unavailable" });
    expect(f.effects).toEqual(original);
    const untagged = saveBonusFixture([{ type: "mechanical", stat: "saving_throw_bonus", op: "formula", expr: "1" }], active);
    expect(untagged.savingThrow).toMatchObject({ status: "available", modifier: 5 });
  });
  it.each(["1", "1d4", 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects unsupported raw/output values without rounding (%s)", value => {
    const f = saveBonusFixture([{ type: "mechanical", stat: "saving_throw_bonus", op: "add", value }], null);
    expect(f.bonus).toMatchObject({ status: "unavailable" });
  });
  it("rejects mechanical grant and inactive numeric-string target without interpreting intent", () => {
    for (const effect of [
      { type: "mechanical", stat: "saving_throw_bonus", op: "grant", value: 1 },
      { type: "mechanical", stat: "saving_throw_bonus", op: "add", value: "1", condition: { field: "rage_active", op: "eq", value: true } },
    ] as Effect[]) expect(saveBonusFixture([effect], null).bonus).toMatchObject({ status: "unavailable" });
  });
  it("uses a unique declared computed result and never falls back to a convenient stats copy", () => {
    const f = saveBonusFixture(); f.schema.derived_stats.push({ slug: "saving_throw_bonus", name: "Saving throw bonus", formula: "3" });
    const result = evaluate(f.base, f.effects, f.schema, f.sources, f.state as Record<string, unknown>);
    expect(result.stats).not.toHaveProperty("saving_throw_bonus");
    expect(resolveSavingThrowBonus(result, f.schema, f.effects)).toEqual({ status: "available", bonus: 4 });
    delete result.computed.saving_throw_bonus; result.stats.saving_throw_bonus = 99;
    expect(resolveSavingThrowBonus(result, f.schema, f.effects)).toMatchObject({ status: "unavailable" });
    f.schema.derived_stats.push({ slug: "saving_throw_bonus", name: "Duplicate", base: 5 });
    expect(resolveSavingThrowBonus(result, f.schema, f.effects)).toMatchObject({ status: "unavailable" });
  });
  it("refuses undeclared computed, NaN/Infinity, missing raw inputs and unsafe final sums", () => {
    const f = saveBonusFixture();
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      const result = { ...f.result, stats: { ...f.result.stats, saving_throw_bonus: value } };
      expect(resolveSavingThrowBonus(result, f.schema, f.effects)).toMatchObject({ status: "unavailable" });
    }
    expect(resolveSavingThrowBonus({ ...f.result, computed: { ...f.result.computed, saving_throw_bonus: 1 } }, f.schema, f.effects)).toMatchObject({ status: "unavailable" });
    expect(resolveSavingThrowBonus(f.result, f.schema, undefined)).toMatchObject({ status: "unavailable" });
    expect(resolveSavingThrowModifier(2, 2, f.result.grants, "saving_throw_constitution", { status: "available", bonus: Number.MAX_SAFE_INTEGER })).toMatchObject({ status: "unavailable" });
    expect(resolveSavingThrowModifier(2.5, 2, [], "saving_throw_constitution", f.bonus)).toMatchObject({ status: "unavailable" });
  });
  it("retains declared ability modifier formulas; does not silently rederive missing values", () => {
    const f = saveBonusFixture(); f.schema.derived_stats.push({ slug: "constitution_mod", name: "CON modifier", formula: "4" });
    const result = evaluate(f.base, f.effects, f.schema, f.sources, f.state as Record<string, unknown>);
    expect(resolveSavingThrowModifier(getConfirmedAbilityModifier(result, f.schema, "constitution"), result.computed.proficiency_bonus,
      result.grants, "saving_throw_constitution", f.bonus)).toMatchObject({ modifier: 7 });
    delete result.computed.constitution_mod;
    expect(resolveSavingThrowModifier(getConfirmedAbilityModifier(result, f.schema, "constitution"), result.computed.proficiency_bonus,
      result.grants, "saving_throw_constitution", f.bonus)).toMatchObject({ status: "unavailable" });
  });
});
