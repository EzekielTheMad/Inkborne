import { describe, expect, it } from "vitest";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import type { Effect } from "@/lib/types/effects";

const race: Effect = { type: "choice", choice_id: "half-elf-ability-bonus-choice", choose: 2,
  from: ["strength", "dexterity", "constitution", "intelligence", "wisdom"], grant_type: "ability_bonus" };
const skill: Effect = { type: "choice", choice_id: "fighter-skills", choose: 2,
  from: ["skill-athletics", "skill-perception"], grant_type: "proficiency" };
const refs = [{ content_definitions: { effects: [race, skill] } }];
describe("saved source-owned choice mechanics", () => {
  it("applies the actual two Half-Elf bonuses and class skill grants once", () => {
    const effects = resolveCharacterChoiceEffects(refs, { resolved_choices: {
      "half-elf-ability-bonus-choice": ["strength", "constitution"], "fighter-skills": ["skill-athletics"],
    } });
    expect(effects.filter(effect => effect.type === "mechanical")).toEqual([
      { type: "mechanical", stat: "strength", op: "add", value: 1 },
      { type: "mechanical", stat: "constitution", op: "add", value: 1 },
    ]);
    expect(effects.filter(effect => effect.type === "grant")).toEqual([{ type: "grant", stat: "athletics", value: "proficient" }]);
  });
  it("does not evaluate stale, duplicate, excessive or unowned selections", () => {
    for (const values of [["charisma"], ["strength", "strength"], ["strength", "dexterity", "wisdom"], ["not_a_formula()"]]) {
      expect(resolveCharacterChoiceEffects(refs, { resolved_choices: { "half-elf-ability-bonus-choice": values } })
        .filter(effect => effect.type === "mechanical")).toEqual([]);
    }
    expect(resolveCharacterChoiceEffects([...refs, ...refs], { resolved_choices: { "half-elf-ability-bonus-choice": ["strength"] } })
      .filter(effect => effect.type === "mechanical")).toEqual([]);
  });
  it("normalizes fixed API skill grants to the sheet vocabulary without altering their source", () => {
    const fixed: Effect = { type: "grant", stat: "skill-religion", value: "proficient" };
    expect(resolveCharacterChoiceEffects([{ content_definitions: { effects: [fixed] } }], {}))
      .toEqual([{ ...fixed, stat: "religion" }]);
    expect(fixed.stat).toBe("skill-religion");
  });

  it.each([["skill-animal-handling", "animal_handling"], ["skill-sleight-of-hand", "sleight_of_hand"]])(
    "uses the sheet key for fixed, selected and Expertise grants in %s", (sourceStat, sheetStat) => {
      const sources = [{ content_definitions: { effects: [
        { type: "grant", stat: sourceStat, value: "proficient" },
        { type: "choice", choice_id: "skills", choose: 1, from: [sourceStat], grant_type: "proficiency" },
        { type: "choice", choice_id: "expertise", choose: 1, from: [sourceStat], grant_type: "expertise" },
      ] as Effect[] } }];
      const original = JSON.stringify(sources);
      const effects = resolveCharacterChoiceEffects(sources, { resolved_choices: { skills: [sourceStat], expertise: [sourceStat] } });
      expect(effects.filter(effect => effect.type === "grant")).toEqual([
        { type: "grant", stat: sheetStat, value: "proficient" }, { type: "grant", stat: sheetStat, value: "expertise" },
      ]);
      expect(JSON.stringify(sources)).toBe(original);
    });
  it("uses a single saved class's API saving-throw proficiency without inferring multiclass roles", () => {
    const fighter: Effect = { type: "grant", stat: "save_strength", value: "proficient" };
    const cleric: Effect = { type: "grant", stat: "save_wisdom", value: "proficient" };
    const classRefs = [
      { content_definitions: { content_type: "class", slug: "fighter", effects: [fighter] } },
      { content_definitions: { content_type: "class", slug: "cleric", effects: [cleric] } },
    ];
    const effects = resolveCharacterChoiceEffects(classRefs, { classes: [{ slug: "fighter", level: 1 }] });
    expect(effects).toContainEqual({ ...fighter, stat: "saving_throw_strength" });
    expect(effects).not.toContainEqual({ ...cleric, stat: "saving_throw_wisdom" });
    const multiclass = resolveCharacterChoiceEffects(classRefs, { classes: [{ slug: "fighter", level: 1 }, { slug: "cleric", level: 1 }] });
    expect(multiclass).not.toContainEqual({ ...fighter, stat: "saving_throw_strength" });
    expect(fighter.stat).toBe("save_strength");
  });

  it("shows fixed and chosen languages in the sheet's proficiency vocabulary once", () => {
    const language: Effect = { type: "choice", choice_id: "acolyte-languages", choose: 2, from: "all_languages", grant_type: "language" };
    const effects = resolveCharacterChoiceEffects([{ content_definitions: { data: { languages: ["common", "elvish"] },
      effects: [language, { type: "grant", stat: "language", value: "common" }] } }],
    { resolved_choices: { "acolyte-languages": ["dwarvish", "gnomish"] } });
    expect(effects.filter(effect => effect.type === "grant")).toEqual([
      { type: "grant", stat: "common", value: "proficient" }, { type: "grant", stat: "elvish", value: "proficient" },
      { type: "grant", stat: "dwarvish", value: "proficient" }, { type: "grant", stat: "gnomish", value: "proficient" },
    ]);
  });
});
