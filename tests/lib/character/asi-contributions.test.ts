import { describe, expect, it } from "vitest";
import { originalAsiFixture, originalAsiPin, asiId, asiSchema } from "../../fixtures/r06-asi";
import { resolveCharacterAsiContributions } from "@/lib/character/asi-contributions";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { evaluate } from "@/lib/engine/evaluator";
import { resolveAbilityMechanics, getConfirmedAbilityModifier } from "@/lib/character/ability-mechanics";
import { computeMaxHp } from "@/lib/character/max-hp";
import type { Effect } from "@/lib/types/effects";

function evaluateFixture(fixture = originalAsiFixture(), effects: Effect[] = [], state: Record<string, unknown> = {}) {
  return evaluate({ ...fixture.character.base_stats, level: 4 }, [...fixture.refs.flatMap(ref => ref.content_definitions.effects), ...effects], asiSchema,
    buildCharacterStructuredSources(fixture.refs, 4, { character: fixture.character, evidence: fixture.evidence }), state);
}
describe("R06.3 original earned immutable ASI contribution", () => {
  it("repairs STR12 to14 once and preserves original pins/choices/effects", () => {
    const fixture = originalAsiFixture(), before = JSON.stringify(fixture);
    expect(evaluateFixture(fixture).stats.strength).toBe(14);
    expect(resolveCharacterAsiContributions(fixture.character, fixture.evidence)).toMatchObject({ status: "available", effects: [{ type: "mechanical", stat: "strength", op: "add", value: 2 }] });
    expect(JSON.stringify(fixture)).toBe(before);
  });
  it("preserves race/static/manual/conditional/formula order instead of a post-evaluation +2", () => {
    const fixture = originalAsiFixture();
    fixture.refs.splice(2, 1); delete fixture.character.choices.race;
    expect(evaluateFixture(fixture, [{ type: "mechanical", stat: "strength", op: "multiply", value: 2 }]).stats.strength).toBe(24);
    expect(evaluateFixture(fixture, [{ type: "mechanical", stat: "strength", op: "formula", expr: "strength * 2" }]).stats.strength).toBe(24);
    expect(evaluateFixture(fixture, [{ type: "mechanical", stat: "strength", op: "add", value: 2 }]).stats.strength).toBe(14);
    const conditional: Effect = { type: "mechanical", stat: "strength", op: "add", value: 3, condition: { field: "boon", op: "eq", value: true } };
    expect(evaluateFixture(fixture, [conditional], { boon: false }).stats.strength).toBe(12);
    expect(evaluateFixture(fixture, [conditional], { boon: true }).stats.strength).toBe(15);
  });
  it("uses permanent CON16/maxHP35 while temporary CON18 leaves raw dice history and maxHP unchanged", () => {
    const f = originalAsiFixture({ mode: "asi", allocations: [{ ability: "constitution", amount: 2 }] });
    const before = JSON.stringify(f), baseline = evaluateFixture(f), live = evaluateFixture(f, [{ type: "mechanical", stat: "constitution", op: "add", value: 2 }]);
    expect(baseline.stats.constitution).toBe(16); expect(live.stats.constitution).toBe(18);
    expect(computeMaxHp(f.character.choices.classes!, { [f.cls.slug]: { slug: f.cls.slug, data: f.cls.data } }, baseline.stats.constitution, f.character.choices.hp_rolls!, "free_choice")).toBe(35);
    expect(JSON.stringify(f)).toBe(before);
  });
  it("accepts split allocations and clean explicit complete empty grants, but never missing evidence", () => {
    const f = originalAsiFixture({ mode: "asi", allocations: [{ ability: "strength", amount: 1 }, { ability: "wisdom", amount: 1 }] });
    expect(evaluateFixture(f).stats).toMatchObject({ strength: 13, wisdom: 11 });
    delete f.character.choices.asi_choices; f.evidence.grants = []; f.refs.splice(1, 1);
    expect(resolveCharacterAsiContributions(f.character, f.evidence).status).toBe("available");
    expect(resolveCharacterAsiContributions(f.character).status).toBe("unavailable");
  });
  it("accepts a legitimate null-grant feat ref only through its exact occurrence tuple and retains independent effects", () => {
    const feat = originalAsiPin("feat", "original-clear-mind", { description: "Original feat control." }, asiId(80), [{ type: "mechanical", stat: "wisdom", op: "add", value: 2 }]);
    const f = originalAsiFixture({ mode: "feat", featId: feat.id, featVersion: feat.version, featName: feat.name });
    f.refs.push(f.ref(feat, asiId(81), null, `choice:asi:${f.grant.id}`));
    expect(evaluateFixture(f).stats.wisdom).toBe(12);
    expect(resolveCharacterAsiContributions(f.character, f.evidence)).toMatchObject({ status: "available", effects: [] });
    f.refs.at(-1)!.choice_source = `choice:asi:${asiId(99)}`;
    expect(resolveCharacterAsiContributions(f.character, f.evidence).status).toBe("unavailable");
  });
  it("resolves a selected subclass's exact frozen occurrence, then rejects it when that subclass is no longer selected", () => {
    const f = originalAsiFixture();
    const sub = originalAsiPin("subclass", "original-study", { parent_class: f.cls.slug, description: "Original subclass control.", levels: [{ level: 4, features: [f.feature.slug] }] }, asiId(85));
    (f.cls.data.levels as Array<{ features: string[] }>).forEach(row => { row.features = []; });
    f.refs.push(f.ref(sub, asiId(86)));
    f.feature.data.subclass = sub.slug;
    f.character.choices.classes![0].subclass = sub.slug;
    f.grant.controller_ref_id = asiId(86); f.grant.controller_type = "subclass"; f.grant.controller_slug = sub.slug;
    expect(evaluateFixture(f).stats.strength).toBe(14);
    delete f.character.choices.classes![0].subclass;
    expect(resolveCharacterAsiContributions(f.character, f.evidence).status).toBe("unavailable");
  });
  it.each(["missing-column", "foreign", "wrong-version", "missing-controller", "duplicate-grant", "unearned", "wrong-manifest", "forged-context", "duplicate-ability", "invalid-allocation"])("fails closed for %s without mutation", kind => {
    const f = originalAsiFixture();
    if (kind === "missing-column") delete (f.refs[1] as Partial<typeof f.refs[number]>).feature_grant_id;
    if (kind === "foreign") f.refs[1].character_id = asiId(99);
    if (kind === "wrong-version") f.grant.feature_version = 2;
    if (kind === "missing-controller") f.evidence.refs = f.refs.filter(ref => ref.id !== f.grant.controller_ref_id);
    if (kind === "duplicate-grant") f.evidence.grants.push({ ...f.grant, id: asiId(99) });
    if (kind === "unearned") f.character.choices.classes![0].level = 3;
    if (kind === "wrong-manifest") f.grant.unlock_level = 3;
    if (kind === "forged-context") { f.refs[1].feature_grant_id = null; f.refs[1].context = { feature_grant_id: f.grant.id }; }
    if (kind === "duplicate-ability") f.character.choices.asi_choices![f.feature.slug] = { mode: "asi", allocations: [{ ability: "strength", amount: 1 }, { ability: "strength", amount: 1 }] };
    if (kind === "invalid-allocation") f.character.choices.asi_choices![f.feature.slug] = { mode: "asi", allocations: [{ ability: "strength", amount: Number.NaN }] };
    const before = JSON.stringify(f);
    expect(resolveCharacterAsiContributions(f.character, f.evidence).status).toBe("unavailable");
    expect(JSON.stringify(f)).toBe(before);
  });
  it("requires finite saved scores and unique shipped definitions, retains cap-unverified without clamp", () => {
    const f = originalAsiFixture(); f.character.base_stats.strength = 20;
    const result = evaluateFixture(f);
    expect(result.stats.strength).toBe(24);
    expect(resolveAbilityMechanics(f.character.base_stats, result, asiSchema)).toMatchObject({ status: "available", capUnverified: true });
    expect(resolveAbilityMechanics(f.character.base_stats, result, { ...asiSchema, ability_scores: [...asiSchema.ability_scores, asiSchema.ability_scores[0]] }).status).toBe("unavailable");
    const missing = { ...f.character.base_stats }; delete (missing as Partial<typeof missing>).constitution;
    expect(resolveAbilityMechanics(missing, result, asiSchema).status).toBe("unavailable");
    expect(getConfirmedAbilityModifier({ ...result, computed: { ...result.computed, strength_mod: Number.NaN } }, { ...asiSchema, derived_stats: [...asiSchema.derived_stats, { slug: "strength_mod", name: "Strength modifier", formula: "strength" }] }, "strength")).toBeNull();
  });
});
