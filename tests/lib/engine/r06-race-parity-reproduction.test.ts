import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { computeMaxHp } from "@/lib/character/max-hp";
import { evaluateMulticlassPrereq } from "@/lib/builder/multiclass-prereqs";
import { transformSubraceEntry } from "../../../scripts/transformers/races";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { syntheticApiRace, transformedRace, syntheticRacePin, raceParityBase, raceParitySchema, evaluateSyntheticPin, isAbilityAdd, pinnedRaceRef } from "../../fixtures/r06-race-parity";

// The original dual fixture retains historical arithmetic; newly imported
// content uses the approved once-only contract without rewriting old pins.
describe("R06.1 source-proven synthetic race-pin reproduction", () => {
  it("the actual new transformer declares effects-only; explicit legacy pins retain both representations", () => {
    expect(syntheticApiRace.ability_bonuses.map(item => item.bonus)).toEqual([2, 2]);
    expect(transformedRace.data.scores).toBeUndefined();
    expect(transformedRace.data.ability_score_representation).toEqual({ version: 1, mode: "effects" });
    expect(transformedRace.effects.filter(isAbilityAdd)).toEqual([
      { type: "mechanical", stat: "strength", op: "add", value: 2 },
      { type: "mechanical", stat: "constitution", op: "add", value: 2 },
    ]);
    const { definition, pin } = syntheticRacePin();
    expect(pin.data).toEqual(definition.data);
    expect(pin.data.scores).toEqual([2, 0, 2, 0, 0, 0]);
    expect(pin.data.ability_score_representation).toBeUndefined();
    expect(pin.effects).toEqual(definition.effects);
    const live = evaluateSyntheticPin(pin);
    const preview = evaluate(raceParityBase, pin.effects, raceParitySchema);
    expect({ expected: [12, 14], live: [live.stats.strength, live.stats.constitution], preview: [preview.stats.strength, preview.stats.constitution] })
      .toEqual({ expected: [12, 14], live: [14, 16], preview: [12, 14] });
    expect(live.speed.walk).toBe(35);
    expect(live.computed.movement_speed).toBe(35);
    // Separate existing string-size-to-numeric defect, never a proposed fix.
    expect(pin.data.size).toBe("Medium");
    expect(live.stats.size).toBe(0);
    const imported = syntheticRacePin("imported").pin;
    expect(evaluateSyntheticPin(imported).stats).toMatchObject({ strength: 12, constitution: 14 });
    expect(imported.data.scores).toBeUndefined();
  });

  it.each(["scores-only", "effects-only"] as const)("unambiguous %s input contributes the original bonus once live", mode => {
    const { pin } = syntheticRacePin(mode);
    const live = evaluateSyntheticPin(pin);
    expect([live.stats.strength, live.stats.constitution]).toEqual([12, 14]);
    const preview = evaluate(raceParityBase, pin.effects, raceParitySchema);
    expect([preview.stats.strength, preview.stats.constitution])
      .toEqual(mode === "scores-only" ? [10, 12] : [12, 14]);
  });

  it("identical manual numeric bonus is independent intent, not evidence of a duplicate", () => {
    const manual = { type: "mechanical" as const, stat: "strength", op: "add" as const, value: 2 };
    const { pin } = syntheticRacePin("scores-only", [manual]);
    expect(evaluateSyntheticPin(pin).stats.strength).toBe(14); // base10 + original2 + manual2
    expect(pin.effects.filter(isAbilityAdd)).toEqual([manual]);
    // Two byte-identical entries still stack; neither array value records intent.
    const { pin: twice } = syntheticRacePin("effects-only", [manual]);
    expect(evaluateSyntheticPin(twice).stats.strength).toBe(14);
    expect(twice.effects.filter(isAbilityAdd).filter(effect => effect.type === "mechanical" && effect.stat === "strength")).toHaveLength(2);
  });

  it("conditional manual bonus survives and follows actual state, regardless of matching number", () => {
    const conditional = { type: "mechanical" as const, stat: "strength", op: "add" as const, value: 2,
      condition: { field: "rage_active", op: "eq" as const, value: true } };
    const { pin } = syntheticRacePin("scores-only", [conditional]);
    expect(evaluateSyntheticPin(pin, { rage_active: false }).stats.strength).toBe(12);
    expect(evaluateSyntheticPin(pin, { rage_active: true }).stats.strength).toBe(14);
    expect(pin.effects.at(-1)).toEqual(conditional);
  });

  it("manual formula retains its expression and current ordering; it is not a numeric duplicate", () => {
    const formula = { type: "mechanical" as const, stat: "strength", op: "formula" as const, expr: "strength + 2" };
    const { pin } = syntheticRacePin("scores-only", [formula]);
    expect(evaluateSyntheticPin(pin).stats.strength).toBe(14);
    expect(evaluate(raceParityBase, pin.effects, raceParitySchema).stats.strength).toBe(12);
    expect(pin.effects.at(-1)).toEqual(formula);
  });

  it("doubling CON alters baseline HP and doubling STR changes the live prerequisite result", () => {
    const dual = evaluateSyntheticPin(syntheticRacePin().pin);
    const once = evaluateSyntheticPin(syntheticRacePin("effects-only").pin);
    const classes = [{ slug: "synthetic-test-class", level: 3 }];
    const classData = { "synthetic-test-class": { slug: "synthetic-test-class", data: { hit_die: 8 } } };
    expect(computeMaxHp(classes, classData, once.stats.constitution)).toBe(24);
    expect(computeMaxHp(classes, classData, dual.stats.constitution)).toBe(27);
    expect(evaluateMulticlassPrereq("barbarian", once.stats, classes).state).toBe("not-met");
    expect(evaluateMulticlassPrereq("barbarian", dual.stats, classes).state).toBe("met");
  });

  it("a same-value feature effect is a separate source and continues to stack", () => {
    const { pin } = syntheticRacePin("scores-only");
    const feature = { type: "mechanical" as const, stat: "strength", op: "add" as const, value: 2 };
    const sources = buildCharacterStructuredSources([
      pinnedRaceRef(pin), { content_definitions: { content_type: "feature", data: {} } },
    ], 3);
    expect(evaluate(raceParityBase, [...pin.effects, feature], raceParitySchema, sources).stats.strength).toBe(14);
    expect(pin.data.scores).toEqual([2, 0, 2, 0, 0, 0]);
  });

  it("baseline HP input stays distinct from temporary live Constitution", () => {
    const { pin } = syntheticRacePin("scores-only");
    const baseline = evaluateSyntheticPin(pin);
    const sources = buildCharacterStructuredSources([pinnedRaceRef(pin)], 3);
    const active = { type: "mechanical" as const, stat: "constitution", op: "add" as const, value: 2 };
    const live = evaluate(raceParityBase, [...pin.effects, active], raceParitySchema, sources);
    expect([baseline.stats.constitution, live.stats.constitution]).toEqual([14, 16]);
    const classes = [{ slug: "synthetic-test-class", level: 3 }];
    const classData = { "synthetic-test-class": { slug: "synthetic-test-class", data: { hit_die: 8 } } };
    expect(computeMaxHp(classes, classData, baseline.stats.constitution)).toBe(24);
    expect(computeMaxHp(classes, classData, live.stats.constitution)).toBe(27);
    // Actual page/durable-model call sites deliberately use baseline for maxHp;
    // this is a pure input-boundary control, not a provider/DB workflow test.
  });

  it("latest v2 input does not modify the parsed v1 pin or its observed mechanics", () => {
    const v1 = syntheticRacePin();
    const before = JSON.stringify(v1.snapshot);
    const v2 = syntheticRacePin("effects-only", [], 2);
    expect(v2.pin.version).toBe(2);
    expect(evaluateSyntheticPin(v2.pin).stats.strength).toBe(12);
    expect(evaluateSyntheticPin(v1.pin).stats.strength).toBe(14);
    expect(JSON.stringify(v1.snapshot)).toBe(before);
    expect(v1.pin.version).toBe(1);
  });

  it("collector takes the first race only; no policy is inferred for competing or subrace sources", () => {
    const dual = syntheticRacePin().pin;
    const scores = syntheticRacePin("scores-only").pin;
    const child = transformSubraceEntry({ index: "r06-synthetic-ember-child", name: "Synthetic Ember Child",
      desc: "Original synthetic child notes.", race: { index: syntheticApiRace.index, name: syntheticApiRace.name },
      ability_bonuses: [{ ability_score: { index: "con", name: "CON" }, bonus: 1 }],
      racial_traits: [], starting_proficiencies: [], languages: [],
    });
    const subrace = parseContentVersionSnapshot({ ...syntheticRacePin().snapshot,
      content_id: "77777777-7777-4777-8777-777777777777", content_type_snapshot: "subrace",
      slug_snapshot: child.slug, name_snapshot: child.name, data_snapshot: child.data, effects_snapshot: child.effects,
    });
    expect(subrace).not.toBeNull();
    const sources = buildCharacterStructuredSources([
      pinnedRaceRef(dual), pinnedRaceRef(scores), { content_definitions: subrace },
    ], 3);
    expect(sources.raceData).toBe(dual.data);
    expect(sources.featureData).toEqual([]);
  });
});
