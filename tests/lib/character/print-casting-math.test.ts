import { describe, expect, it } from "vitest";
import { buildCharacterPrintModel } from "@/lib/character/print-model";
import { printFixture } from "../../../e2e/print/fixtures";

describe("print uses the same validated casting math as execution", () => {
  it.each(["missing", "duplicate", "nonfinite", "missing-proficiency"])("refuses %s active caster math even if a caller omits summary status", problem => {
    const input = printFixture("caster");
    if (problem === "missing") input.schema.ability_scores = input.schema.ability_scores.filter(ability => ability.slug !== "intelligence");
    if (problem === "duplicate") input.schema.ability_scores.push({ ...input.schema.ability_scores.find(ability => ability.slug === "intelligence")! });
    if (problem === "nonfinite") input.evalResult.stats.intelligence = Infinity;
    if (problem === "missing-proficiency") delete input.evalResult.computed.proficiency_bonus;
    // Required math now refuses the snapshot before the caster-summary stage.
    // The original no-output oracle remains: no invalid value reaches paper.
    expect(() => buildCharacterPrintModel(input)).toThrow("Required saved mechanical values are unavailable");
  });
  it("uses evaluated ability scores rather than a divergent derived modifier", () => {
    const input = printFixture("caster"); input.evalResult.stats.intelligence_mod = 99;
    expect(buildCharacterPrintModel(input).stats).toContainEqual({ name: "wizard spellcasting", value: "DC 15; attack +7; intelligence" });
  });
  it("preserves ordinary noncaster printing without demanding casting math", () => {
    const input = printFixture("martial"); expect(input.casterInfo.classes).toHaveLength(0);
    expect(buildCharacterPrintModel(input).name).toBe(input.character.name);
  });
});
