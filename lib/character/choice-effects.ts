import type { Effect } from "@/lib/types/effects";
import type { CharacterChoices } from "@/lib/types/character";
import { fixedLanguages, isLanguageChoiceCategory } from "@/lib/builder/choice-validation";
import { resolveExpertiseChoice } from "@/lib/builder/expertise";
import { classRoleEvaluationRef, classRoleForRef, type BuilderClassRoleRef } from "./builder-class-roles";

type Ref = BuilderClassRoleRef;
const abilities = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]);

function skillGrantStat(value: string): string {
  if (!value.startsWith("skill-")) return value;
  const skill = value.slice(6);
  // The 2014 catalog uses hyphens; these two published sheet keys use underscores.
  return skill === "animal-handling" ? "animal_handling" : skill === "sleight-of-hand" ? "sleight_of_hand" : skill;
}

/** Project finite saved choices from their loaded immutable source effects.
 * Choice values never supply formulas, amounts, arbitrary stats or effect JSON.
 * Spell acquisitions and selected feature pins are projected by the database.
 */
export function resolveCharacterChoiceEffects(refs: readonly Ref[], choices: CharacterChoices): Effect[] {
  const projected = refs.map(ref => ({ ref: classRoleEvaluationRef(ref, choices), role: classRoleForRef(ref, choices) }));
  const effects = projected.flatMap(({ ref, role }) => (ref.content_definitions?.effects ?? []).map(effect =>
    effect.type === "grant" && ["proficient", "expertise"].includes(effect.value) && effect.stat.startsWith("skill-")
      ? { ...effect, stat: skillGrantStat(effect.stat) } : effect.type === "grant" && effect.value === "proficient"
        && (role?.role === "original" || choices.classes?.length === 1) && ref.content_definitions?.content_type === "class"
        && choices.classes?.some(cls => cls.slug === ref.content_definitions?.slug)
        && effect.stat.startsWith("save_") && abilities.has(effect.stat.slice(5))
        ? { ...effect, stat: `saving_throw_${effect.stat.slice(5)}` }
        : effect.type === "grant" && ["language", "languages"].includes(effect.stat)
          ? { ...effect, stat: effect.value, value: "proficient" } : effect));
  const definitions = effects.filter(effect => effect.type === "choice");
  const derived: Effect[] = fixedLanguages(projected.map(({ ref }) => ({ data: ref.content_definitions?.data ?? {},
    effects: ref.content_definitions?.effects }))).map(language => ({ type: "grant", stat: language, value: "proficient" }));
  for (const choice of definitions) {
    if (definitions.filter(other => other.choice_id === choice.choice_id).length !== 1) continue;
    const selections = choices.resolved_choices?.[choice.choice_id];
    if (!Array.isArray(selections) || !Number.isInteger(choice.choose) || choice.choose < 1
      || selections.length > choice.choose || new Set(selections).size !== selections.length) continue;
    if (!selections.every(value => typeof value === "string" && value.length > 0 && value.length <= 300
      && (Array.isArray(choice.from) ? choice.from.includes(value) : isLanguageChoiceCategory(choice) && /^[a-z][a-z0-9-]*$/.test(value)))) continue;
    for (const value of selections) {
      if (choice.grant_type === "ability_bonus" && abilities.has(value)) {
        derived.push({ type: "mechanical", stat: value, op: "add", value: 1 });
      } else if (["proficiency", "skill", "tool", "weapon", "armor"].includes(choice.grant_type)) {
        derived.push({ type: "grant", stat: skillGrantStat(value), value: "proficient" });
      } else if (choice.grant_type === "expertise") {
        if (resolveExpertiseChoice(choice, refs, choices).from.includes(value)) {
          derived.push({ type: "grant", stat: skillGrantStat(value), value: "expertise" });
        }
      } else if (choice.grant_type === "language") {
        derived.push({ type: "grant", stat: value, value: "proficient" });
      }
    }
  }
  const grants = new Set<string>();
  return [...effects, ...derived].filter(effect => {
    if (effect.type !== "grant") return true;
    const key = `${effect.stat}\u0000${effect.value}`;
    if (grants.has(key)) return false;
    grants.add(key); return true;
  });
}
