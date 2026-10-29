import { describe, expect, it } from "vitest";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import { attachBuilderClassRoles } from "@/lib/character/builder-class-roles";
import type { CharacterChoices } from "@/lib/types/character";
import type { Effect } from "@/lib/types/effects";

const race: Effect = { type: "choice", choice_id: "half-elf-ability-bonus-choice", choose: 2,
  from: ["strength", "dexterity", "constitution", "intelligence", "wisdom"], grant_type: "ability_bonus" };
const skill: Effect = { type: "choice", choice_id: "fighter-skills", choose: 2,
  from: ["skill-athletics", "skill-perception"], grant_type: "proficiency" };
const refs = [{ content_definitions: { effects: [race, skill] } }];

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
function rogueSources(secondary = false) {
  const source = (slug: string, key: number, data: Record<string, unknown>, effects: Effect[]) => ({
    id: id(key), character_id: id(1), content_id: id(key + 10), content_version: 1,
    content_definitions: { id: id(key + 10), version: 1, content_type: "class", slug, data, effects },
  });
  const rogueSkills: Effect = { type: "choice", choice_id: "rogue-skills", choose: 4,
    from: ["skill-acrobatics", "skill-perception", "skill-sleight-of-hand", "skill-stealth", "skill-deception"], grant_type: "proficiency" };
  const rogue = source("rogue", 3, { toolProfs: ["thieves-tools"], starting_proficiencies: ["light-armor", "thieves-tools"],
    saving_throws: ["dexterity", "intelligence"] }, [
    { type: "grant", stat: "save_dexterity", value: "proficient" },
    { type: "grant", stat: "save_intelligence", value: "proficient" }, rogueSkills,
  ]);
  const fighter = source("fighter", 4, { toolProfs: [], starting_proficiencies: ["heavy-armor"], saving_throws: ["strength"] }, [
    { type: "grant", stat: "save_strength", value: "proficient" },
    { type: "choice", choice_id: "fighter-skills", choose: 2, from: ["skill-athletics", "skill-perception"], grant_type: "proficiency" },
  ]);
  const expertise = { content_definitions: { content_type: "feature", slug: "rogue-expertise-1", effects: [
    { type: "choice", choice_id: "rogue-expertise-1", choose: 2,
      from: ["skill-acrobatics", "skill-athletics", "skill-perception", "skill-stealth", "thieves-tools"], grant_type: "expertise" },
  ] as Effect[] }, id: id(5), character_id: id(1) };
  const classRefs = secondary ? [rogue, fighter] : [rogue];
  const sourceRefs = [...classRefs, expertise];
  const choices: CharacterChoices = { classes: classRefs.map(ref => ({ slug: ref.content_definitions.slug, level: 3,
    occurrence_id: id(ref === rogue ? 23 : 24) })), resolved_choices: {
    "rogue-skills": secondary ? ["skill-stealth"] : ["skill-acrobatics", "skill-perception", "skill-sleight-of-hand", "skill-stealth"],
    "rogue-expertise-1": secondary ? ["skill-athletics", "skill-stealth"] : ["skill-perception", "skill-stealth"],
    ...(secondary ? { "fighter-skills": ["skill-athletics", "skill-perception"] } : {}),
  } };
  const parent = { id: id(1), system_id: id(2), action_revision: "8", choices };
  const raw = { status: "available", contract_version: 1, character_id: parent.id, system_id: parent.system_id,
    action_revision: parent.action_revision, original_occurrence_id: id(secondary ? 24 : 23), source_order: sourceRefs.map(ref => ref.id),
    class_sources: classRefs.map(ref => ({ occurrence_id: id(ref === rogue ? 23 : 24), controller_ref_id: ref.id,
      content_id: ref.content_id, content_version: ref.content_version, role: secondary && ref === rogue ? "secondary" : "original",
      raw_effects: ref.content_definitions.effects, raw_data: ref.content_definitions.data,
      evaluation_effects: secondary && ref === rogue ? [{ ...rogueSkills, choose: 1 }] : ref.content_definitions.effects,
      evaluation_data: secondary && ref === rogue ? { ...ref.content_definitions.data, saving_throws: [],
        starting_proficiencies: ["light-armor", "thieves-tools"], toolProfs: ["thieves-tools"] } : ref.content_definitions.data,
    })) };
  return { refs: sourceRefs, choices, parent, raw };
}
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

  it("projects the original Rogue's fixed tool proficiency even when both Expertise picks are skills", () => {
    const input = rogueSources(), before = JSON.stringify(input);
    const admitted = attachBuilderClassRoles(input.refs, input.raw, input.parent);
    expect(admitted.classRoles.status).toBe("available");
    const grants = resolveCharacterChoiceEffects(admitted.refs, input.choices).filter(effect => effect.type === "grant");
    expect(grants.filter(effect => effect.stat === "thieves-tools")).toEqual([
      { type: "grant", stat: "thieves-tools", value: "proficient" },
    ]);
    expect(grants.filter(effect => effect.value === "expertise").map(effect => effect.stat).sort()).toEqual(["perception", "stealth"]);
    expect(grants.filter(effect => ["acrobatics", "perception", "sleight_of_hand", "stealth"].includes(effect.stat)
      && effect.value === "proficient")).toHaveLength(4);
    expect(grants).toContainEqual({ type: "grant", stat: "saving_throw_dexterity", value: "proficient" });
    expect(grants.some(effect => ["deception", "light-armor"].includes(effect.stat))).toBe(false);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("keeps verified secondary Rogue tools and its one selected skill without starting saves or unselected skills", () => {
    const input = rogueSources(true), before = JSON.stringify(input);
    const admitted = attachBuilderClassRoles(input.refs, input.raw, input.parent);
    expect(admitted.classRoles.status).toBe("available");
    const grants = resolveCharacterChoiceEffects(admitted.refs, input.choices).filter(effect => effect.type === "grant");
    expect(grants).toContainEqual({ type: "grant", stat: "thieves-tools", value: "proficient" });
    expect(grants).toContainEqual({ type: "grant", stat: "stealth", value: "proficient" });
    expect(grants).toContainEqual({ type: "grant", stat: "saving_throw_strength", value: "proficient" });
    expect(grants.some(effect => ["saving_throw_dexterity", "saving_throw_intelligence", "save_dexterity", "save_intelligence",
      "acrobatics", "sleight_of_hand", "deception", "light-armor", "heavy-armor"].includes(effect.stat))).toBe(false);
    const excessive = { ...input.choices, resolved_choices: { ...input.choices.resolved_choices,
      "rogue-skills": ["skill-stealth", "skill-acrobatics"] } };
    const invalid = resolveCharacterChoiceEffects(admitted.refs, excessive).filter(effect => effect.type === "grant");
    expect(invalid.some(effect => ["stealth", "acrobatics"].includes(effect.stat))).toBe(false);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("rejects missing, stale or mismatched multiclass roles before deriving fixed tools", () => {
    const input = rogueSources(true);
    expect(resolveCharacterChoiceEffects(input.refs, input.choices).filter(effect => effect.type === "grant")).toEqual([]);
    for (const raw of [{ ...input.raw, action_revision: "7" }, { ...input.raw,
      class_sources: input.raw.class_sources.map(source => ({ ...source, raw_data: {} })) }, { ...input.raw,
      class_sources: input.raw.class_sources.map(source => ({ ...source, occurrence_id: id(99) })) }]) {
      const result = attachBuilderClassRoles(input.refs, raw, input.parent);
      expect(result.classRoles.status).toBe("unavailable");
      expect(resolveCharacterChoiceEffects(result.refs, input.choices).filter(effect => effect.type === "grant")).toEqual([]);
    }
  });

  it("deduplicates proved data and effect grants without promoting arbitrary tools or invalid choices", () => {
    const fixed: Effect = { type: "grant", stat: "thieves-tools", value: "proficient" };
    const sources = [{ content_definitions: { data: { toolProfs: ["thieves-tools", "thieves-tools", "unproved-tool"] },
      effects: [fixed, fixed, skill] } }];
    for (const selected of [["skill-perception", "skill-perception"], ["unproved-tool"], ["skill-perception", "skill-athletics", "skill-stealth"]]) {
      const effects = resolveCharacterChoiceEffects(sources, { resolved_choices: { "fighter-skills": selected, unknown: ["skill-stealth"] } });
      expect(effects.filter(effect => effect.type === "grant")).toEqual([fixed]);
    }
  });
});
