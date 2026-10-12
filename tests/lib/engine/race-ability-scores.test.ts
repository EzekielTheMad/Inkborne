import { describe, expect, it } from "vitest";
import { resolveRaceAbilityContributions, hasLegacyRaceAbilityAmbiguity, type RaceAbilityData } from "@/lib/engine/race-ability-scores";
import { evaluate } from "@/lib/engine/evaluator";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { syntheticRacePin, pinnedRaceRef, raceParityBase, raceParitySchema, evaluateSyntheticPin } from "../../fixtures/r06-race-parity";

describe("first-race mechanical representation contract", () => {
  it.each(["effects", "scores"] as const)("explicit %s mode resolves one contribution without modifying raw effects", mode => {
    const { pin } = syntheticRacePin(mode === "effects" ? "declared-effects" : "declared-scores");
    const before = JSON.stringify(pin);
    const live = evaluateSyntheticPin(pin);
    expect(live.stats).toMatchObject(mode === "effects" ? { strength: 12, constitution: 14 } : { strength: 14, constitution: 16 });
    expect(JSON.stringify(pin)).toBe(before);
    expect(resolveRaceAbilityContributions(pin.data).length).toBe(mode === "effects" ? 0 : 2);
    expect(hasLegacyRaceAbilityAmbiguity(pin.data, pin.effects)).toBe(false);
  });
  it("absence keeps all legacy contributions and ambiguity never guesses intent from equal values", () => {
    const { pin } = syntheticRacePin();
    expect(evaluateSyntheticPin(pin).stats).toMatchObject({ strength: 14, constitution: 16 });
    expect(hasLegacyRaceAbilityAmbiguity(pin.data, pin.effects)).toBe(true);
    expect(hasLegacyRaceAbilityAmbiguity({ scores: [0, 0, 0, 0, 0, 0] }, pin.effects)).toBe(false);
    expect(resolveRaceAbilityContributions({ scores: [0, 0, 0, 0, 0, 0] })).toEqual([]);
    expect(hasLegacyRaceAbilityAmbiguity(syntheticRacePin("scores-only").pin.data, [])).toBe(false);
    expect(hasLegacyRaceAbilityAmbiguity(syntheticRacePin("effects-only").pin.data, pin.effects)).toBe(false);
  });
  it("scores mode preserves manual condition/formula order and uses the evaluator's state", () => {
    const { pin } = syntheticRacePin("scores-only", [
      { type: "mechanical", stat: "strength", op: "add", value: 2, condition: { field: "rage_active", op: "eq", value: true } },
      { type: "mechanical", stat: "strength", op: "formula", expr: "strength + 2" },
    ]);
    pin.data.ability_score_representation = { version: 1, mode: "scores" };
    const rawOrder = JSON.stringify(pin.effects);
    expect(evaluateSyntheticPin(pin, { rage_active: false }).stats.strength).toBe(14);
    expect(evaluateSyntheticPin(pin, { rage_active: true }).stats.strength).toBe(16);
    expect(JSON.stringify(pin.effects)).toBe(rawOrder);
  });
  it("effects mode keeps metadata scores out while preserving an equal manual source", () => {
    const { pin } = syntheticRacePin("declared-effects", [{ type: "mechanical", stat: "strength", op: "add", value: 2 }]);
    expect(evaluateSyntheticPin(pin).stats.strength).toBe(14);
    expect(pin.effects.filter(effect => effect.type === "mechanical" && effect.stat === "strength")).toHaveLength(2);
  });
  it.each([{ version: 2, mode: "effects" }, { version: 1, mode: "invalid" }, null,
    { version: 1, mode: "effects", extra: true }, { version: 1, mode: "scores" }])("invalid runtime declaration cannot fall back (%j)", declaration => {
    const data = { ability_score_representation: declaration } as unknown as RaceAbilityData;
    expect(() => resolveRaceAbilityContributions(data)).toThrow(/Invalid race ability-score representation/);
    expect(() => evaluate(raceParityBase, [], raceParitySchema, { raceData: data })).toThrow();
  });
  it("first-race precedence and subrace exclusion remain unchanged", () => {
    const first = syntheticRacePin("declared-effects").pin;
    const second = syntheticRacePin("declared-scores").pin;
    const sources = buildCharacterStructuredSources([pinnedRaceRef(first), pinnedRaceRef(second), {
      content_definitions: { content_type: "subrace", data: { scores: [100, 0, 0, 0, 0, 0] } },
    }], 3);
    expect(sources.raceData).toBe(first.data);
    expect(evaluate(raceParityBase, first.effects, raceParitySchema, sources).stats.strength).toBe(12);
  });
});
