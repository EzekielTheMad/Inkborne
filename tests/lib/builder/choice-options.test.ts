import { describe, expect, it } from "vitest";
import { resolveBuilderChoice } from "@/lib/builder/choice-options";
import type { ChoiceEffect } from "@/lib/types/effects";

const language: ChoiceEffect = { type: "choice", choice_id: "background-languages", grant_type: "language", choose: 2, from: "all_languages" };
describe("valid builder discovery options", () => {
  it("omits fixed languages and other valid source picks, retaining its own choices", () => {
    const other = { ...language, choice_id: "race-language", choose: 1 };
    const refs = [{ content_definitions: { data: { languages: ["common"] }, effects: [other, language] } }];
    const result = resolveBuilderChoice(language, refs, { resolved_choices: { "race-language": ["elvish"], "background-languages": ["dwarvish"] } }, ["common", "elvish", "dwarvish", "gnomish"]);
    expect(result.from).toEqual(["dwarvish", "gnomish"]);
    expect(language.from).toBe("all_languages");
  });
  it("does not trust invalid saved picks to reserve an option", () => {
    const refs = [{ content_definitions: { data: {}, effects: [{ ...language, choice_id: "other", from: ["elvish"] }] } }];
    expect(resolveBuilderChoice(language, refs, { resolved_choices: { other: ["dwarvish"] } }, ["elvish", "dwarvish"]).from).toEqual(["elvish", "dwarvish"]);
  });
  it("omits already proficient skills without removing the current source's pick", () => {
    const choice: ChoiceEffect = { type: "choice", choice_id: "skills", grant_type: "proficiency", choose: 2, from: ["skill-athletics", "skill-stealth", "skill-history"] };
    const refs = [{ content_definitions: { data: {}, effects: [choice, { type: "grant" as const, stat: "skill-history", value: "proficient" }] } }];
    expect(resolveBuilderChoice(choice, refs, { resolved_choices: { skills: ["skill-stealth"] } }).from).toEqual(["skill-athletics", "skill-stealth"]);
  });
});
