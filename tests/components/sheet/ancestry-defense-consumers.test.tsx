import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Defenses } from "@/components/sheet/defenses";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import { evaluate, type EvaluationResult } from "@/lib/engine/evaluator";
import { resolveAbilityMechanics } from "@/lib/character/ability-mechanics";
import { buildCharacterPrintModel } from "@/lib/character/print-model";
import { printFixture } from "../../../e2e/print/fixtures";
import { ancestryDefenseFixture } from "../../fixtures/ancestry-defenses";
import type { SystemSchemaDefinition } from "@/lib/types/system";

const base = { strength: 10, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 };
const schema: SystemSchemaDefinition = { ability_scores: Object.keys(base).map(slug => ({ slug, name: slug, abbr: slug.slice(0, 3) })),
  derived_stats: [{ slug: "proficiency_bonus", name: "Proficiency", base: 2 }], proficiency_levels: [], skills: [], resources: [],
  content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
function evaluateFixture(f = ancestryDefenseFixture()) {
  const sources = buildCharacterStructuredSources(f.refs, f.character.level, { character: f.character, evidence: f.evidence });
  return evaluate(base, resolveCharacterChoiceEffects(f.refs, f.character.choices), schema, sources);
}
function printResult(result: EvaluationResult) {
  const ctx = printFixture("martial");
  ctx.evalResult.ancestryDefenses = result.ancestryDefenses;
  ctx.evalResult.dmgres = result.dmgres;
  return ctx;
}
describe("actual ancestry resistance collection, defenses, readiness and print consumers", () => {
  it("unions the owned declaration once with structured resistance while preserving all raw sources", () => {
    const f = ancestryDefenseFixture(); f.root.content_definitions.data.dmgres = ["fire"];
    const before = JSON.stringify(f), result = evaluateFixture(f);
    expect(result.ancestryDefenses).toEqual({ status: "available", dmgres: ["fire"] });
    expect(result.dmgres).toEqual(["fire"]);
    expect(resolveAbilityMechanics(base, result, schema).status).toBe("available");
    expect(JSON.stringify(f)).toBe(before);
    render(<Defenses evalResult={result} />);
    expect(screen.getByText("fire", { exact: true })).toBeVisible();
    expect(buildCharacterPrintModel(printResult(result)).stats).toContainEqual({ name: "Resistances", value: "fire" });
  });
  it("keeps ASI evidence valid while independently blocking unavailable ancestry defenses and print", () => {
    const f = ancestryDefenseFixture(); f.selected.context.root_controller_ref_id = "missing";
    const result = evaluateFixture(f);
    expect(result.asi?.status).toBe("available");
    expect(result.ancestryDefenses?.status).toBe("unavailable");
    expect(resolveAbilityMechanics(base, result, schema)).toMatchObject({ status: "unavailable", reason: expect.stringContaining("ancestry defenses") });
    render(<Defenses evalResult={result} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved ancestry defenses are unavailable");
    expect(screen.queryByText("fire", { exact: true })).toBeNull();
    const print = printResult(result); expect(print.mechanics.status).toBe("available"); // Cannot bypass the result with a caller summary.
    expect(() => buildCharacterPrintModel(print)).toThrow("ancestry defenses are unavailable");
  });
  it("requires the same complete loaded refs and evidence, including explicit empty-ancestry proof", () => {
    const f = ancestryDefenseFixture();
    const missing = buildCharacterStructuredSources(f.refs, 1, { character: f.character });
    expect(missing.ancestryDefenses).toEqual({ status: "unavailable", reason: "incomplete_evidence" });
    const filtered = buildCharacterStructuredSources(f.refs.slice(0, 2), 1, { character: f.character, evidence: f.evidence });
    expect(filtered.ancestryDefenses).toEqual({ status: "unavailable", reason: "incomplete_evidence" });
    f.refs.splice(0); delete f.character.choices.race;
    const empty = evaluateFixture(f);
    expect(empty.ancestryDefenses).toEqual({ status: "available", dmgres: [] });
    expect(resolveAbilityMechanics(base, empty, schema).status).toBe("available");
    expect(buildCharacterPrintModel(printResult(empty)).stats).toContainEqual({ name: "Resistances", value: "None" });
  });
  it("refuses a missing resistance status even when a print fixture supplies other valid mechanics", () => {
    const print = printFixture("martial"); delete print.evalResult.ancestryDefenses;
    expect(() => buildCharacterPrintModel(print)).toThrow("ancestry defenses are unavailable");
  });
});
