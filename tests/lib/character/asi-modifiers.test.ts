import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import { getConfirmedAbilityModifier, resolveAbilityMechanics, assertAbilityMechanics } from "@/lib/character/ability-mechanics";
import { originalAsiFixture, asiSchema } from "../../fixtures/r06-asi";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { getSaveModifier } from "@/lib/sheet/helpers";
function fixture() {
  const f = originalAsiFixture();
  const result = evaluate(f.character.base_stats, f.refs.flatMap(ref => ref.content_definitions.effects), asiSchema,
    buildCharacterStructuredSources(f.refs, 4, { character: f.character, evidence: f.evidence }));
  return { f, result };
}
describe("schema-backed finite ASI modifier admission", () => {
  it("independent canonical save grants participate while legacy save_ keys retain their existing separate gap", () => {
    const { result } = fixture(), modifier = getConfirmedAbilityModifier(result, asiSchema, "strength")!;
    const proficiency = result.computed.proficiency_bonus;
    expect(getSaveModifier(modifier, proficiency, [{ type: "grant", stat: "saving_throw_strength", value: "proficient" }], "saving_throw_strength")).toBe(4);
    expect(getSaveModifier(modifier, proficiency, [{ type: "grant", stat: "save_strength", value: "proficient" }], "saving_throw_strength")).toBe(2);
  });
  it("reads authoritative computed formula rather than old stats-only zero or rederived normal value", () => {
    const { result } = fixture();
    expect(getConfirmedAbilityModifier(result, asiSchema, "strength")).toBe(2);
    const schema = { ...asiSchema, derived_stats: [...asiSchema.derived_stats.filter(entry => entry.slug !== "strength_mod"), { slug: "strength_mod", name: "Strength modifier", formula: "strength" }] };
    expect(getConfirmedAbilityModifier({ ...result, computed: { ...result.computed, strength_mod: 14 } }, schema, "strength")).toBe(14);
    const missing = { ...result, computed: { ...result.computed } }; delete missing.computed.strength_mod;
    expect(getConfirmedAbilityModifier(missing, schema, "strength")).toBeNull();
    expect(getConfirmedAbilityModifier({ ...result, computed: { ...result.computed, strength_mod: Infinity } }, schema, "strength")).toBeNull();
  });
  it("normal score-derived modifier is allowed only when no formula/modifier definition exists", () => {
    const { result } = fixture(), schema = { ...asiSchema, derived_stats: asiSchema.derived_stats.filter(entry => entry.slug !== "strength_mod") };
    expect(getConfirmedAbilityModifier(result, schema, "strength")).toBe(2);
    expect(getConfirmedAbilityModifier({ ...result, stats: { ...result.stats, strength: Number.NaN } }, schema, "strength")).toBeNull();
  });
  it.each([NaN, Infinity, -Infinity, "14", null, undefined])("never accepts missing/coerced/nonfinite required score %s", value => {
    const { f, result } = fixture(), bad = { ...f.character.base_stats, strength: value } as unknown as Record<string, number>;
    const readiness = resolveAbilityMechanics(bad, result, asiSchema);
    expect(readiness.status).toBe("unavailable");
    expect(() => assertAbilityMechanics(readiness, result, asiSchema, { abilities: ["strength"] })).toThrow();
  });
  it("missing derived result or nonfinite final request value cannot fallback to a usable action", () => {
    const { f, result } = fixture(), readiness = resolveAbilityMechanics(f.character.base_stats, result, asiSchema);
    expect(() => assertAbilityMechanics(readiness, result, asiSchema, { computed: ["missing_result"] })).toThrow();
    expect(() => assertAbilityMechanics(readiness, result, asiSchema, { values: [Infinity] })).toThrow();
  });
});
