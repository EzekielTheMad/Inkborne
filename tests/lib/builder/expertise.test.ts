import { describe, expect, it } from "vitest";
import { expertiseProficiencies, resolveExpertiseChoice } from "@/lib/builder/expertise";
import { getBuilderStepStatus, type BuilderStatusRef } from "@/lib/builder/step-status";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import type { CharacterChoices } from "@/lib/types/character";
import type { ChoiceEffect, Effect } from "@/lib/types/effects";

const skills: ChoiceEffect = { type: "choice", choice_id: "rogue-skills", choose: 3,
  from: ["skill-acrobatics", "skill-perception", "skill-stealth", "skill-deception"], grant_type: "proficiency" };
const expertise: ChoiceEffect = { type: "choice", choice_id: "rogue-expertise-1", choose: 2,
  from: ["skill-acrobatics", "skill-perception", "skill-stealth", "thieves-tools"], grant_type: "expertise" };
const later: ChoiceEffect = { ...expertise, choice_id: "rogue-expertise-2" };
const pin = (type: string, slug: string, data: Record<string, unknown>, effects: Effect[]): BuilderStatusRef => ({
  content_id: slug, content_version: 1, content_definitions: { id: slug, version: 1, content_type: type, slug, data, effects },
});
const classRef = pin("class", "rogue", { starting_proficiencies: ["thieves-tools"], levels: [
  { level: 1, features: ["rogue-expertise-1"] }, { level: 6, features: ["rogue-expertise-2"] },
] }, [skills]);
const firstRef = pin("feature", "rogue-expertise-1", { class: "rogue", level: 1, feature_type: "choice" }, [expertise]);
const laterRef = pin("feature", "rogue-expertise-2", { class: "rogue", level: 6, feature_type: "choice" }, [later]);
const refs = [classRef, firstRef];
const choices: CharacterChoices = { classes: [{ slug: "rogue", level: 1 }], resolved_choices: {
  "rogue-skills": ["skill-acrobatics", "skill-perception", "skill-stealth"], "rogue-expertise-1": ["skill-stealth", "thieves-tools"],
} };

describe("source-owned Expertise eligibility", () => {
  it("uses genuine fixed and saved skill/tool proficiency sources", () => {
    const background = pin("background", "acolyte", { skills: ["insight"] }, [{ type: "grant", stat: "skill-religion", value: "proficient" }]);
    expect([...expertiseProficiencies([...refs, background], choices)].sort()).toEqual([
      "skill-acrobatics", "skill-insight", "skill-perception", "skill-religion", "skill-stealth", "thieves-tools",
    ]);
    expect(resolveExpertiseChoice(expertise, refs, choices).from).toEqual(expertise.from);
  });

  it("does not allow Expertise to establish its own missing proficiency", () => {
    expect(resolveExpertiseChoice(expertise, [firstRef], choices).from).toEqual([]);
    const changed = { ...choices, resolved_choices: { ...choices.resolved_choices, "rogue-skills": ["skill-acrobatics", "skill-perception", "skill-deception"] } };
    expect(resolveExpertiseChoice(expertise, refs, changed).from).toEqual(["skill-acrobatics", "skill-perception", "thieves-tools"]);
    expect(resolveCharacterChoiceEffects(refs, changed).filter(effect => effect.type === "grant" && effect.value === "expertise"))
      .toEqual([{ type: "grant", stat: "thieves-tools", value: "expertise" }]);
  });

  it("excludes prior Expertise picks from the newly earned level-six choice", () => {
    const allRefs = [...refs, laterRef];
    expect(resolveExpertiseChoice(later, allRefs, choices).from).toEqual(["skill-acrobatics", "skill-perception"]);
    const duplicate = { ...choices, resolved_choices: { ...choices.resolved_choices, "rogue-expertise-2": ["skill-stealth"] } };
    expect(resolveCharacterChoiceEffects(allRefs, duplicate).filter(effect => effect.type === "grant" && effect.stat === "stealth" && effect.value === "expertise")).toEqual([]);
  });

  it("rejects ambiguous or malformed proficiency evidence and unproved class roles", () => {
    expect(expertiseProficiencies([...refs, classRef], choices).has("skill-stealth")).toBe(false);
    const malformed = { ...choices, resolved_choices: { ...choices.resolved_choices, "rogue-skills": ["skill-stealth", "skill-stealth"] } };
    expect(expertiseProficiencies(refs, malformed).has("skill-stealth")).toBe(false);
    expect(expertiseProficiencies(refs, { ...choices, classes: [{ slug: "rogue", level: 1 }, { slug: "fighter", level: 1 }] }).has("thieves-tools")).toBe(false);
  });

  it("marks a pruned Expertise choice incomplete until valid replacement picks are saved", () => {
    expect(getBuilderStepStatus("class", choices, {}, undefined, refs)).toBe("complete");
    const pruned = { ...choices, resolved_choices: { ...choices.resolved_choices,
      "rogue-skills": ["skill-acrobatics", "skill-perception", "skill-deception"], "rogue-expertise-1": ["thieves-tools"] } };
    expect(getBuilderStepStatus("class", pruned, {}, undefined, refs)).toBe("in_progress");
    expect(getBuilderStepStatus("class", { ...pruned, resolved_choices: { ...pruned.resolved_choices,
      "rogue-expertise-1": ["skill-acrobatics", "thieves-tools"] } }, {}, undefined, refs)).toBe("complete");
    expect(getBuilderStepStatus("class", { ...choices, classes: [{ slug: "rogue", level: 6 }] }, {}, undefined, [...refs, laterRef])).toBe("in_progress");
  });
});
