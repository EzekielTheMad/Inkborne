import type { CharacterChoices } from "@/lib/types/character";
import type { ChoiceEffect, Effect } from "@/lib/types/effects";
import { classRoleEvaluationRef, type BuilderClassRoleRef } from "@/lib/character/builder-class-roles";
import { expertiseProficiencies } from "./expertise";
import { favoredEnemyLanguages } from "./favored-enemy";
import { fixedLanguages, resolveChoiceOptions } from "./choice-validation";

/** Narrow discovery to unowned grants; an unavailable saved pick is never erased. */
export function resolveBuilderChoice(choice: ChoiceEffect, refs: readonly BuilderClassRoleRef[], choices: CharacterChoices,
  languages?: readonly string[]): ChoiceEffect {
  const active = refs.map(ref => classRoleEvaluationRef(ref, choices));
  const definitions = active.flatMap(ref => ref.content_definitions
    ? [{ data: ref.content_definitions.data ?? {}, effects: ref.content_definitions.effects ?? [] }] : []);
  const options = resolveChoiceOptions(choice, languages, fixedLanguages(definitions));
  if (!options) return choice;
  if (choice.grant_type === "language") {
    const occupied = new Set([...fixedLanguages(definitions), ...favoredEnemyLanguages(refs, choices, languages)]);
    const effects = definitions.flatMap(definition => definition.effects ?? []).filter(effect => effect.type === "choice");
    for (const effect of effects) {
      if (effect.grant_type !== "language" || effect.choice_id === choice.choice_id
        || effects.filter(other => other.choice_id === effect.choice_id).length !== 1) continue;
      const picks = choices.resolved_choices?.[effect.choice_id];
      const offered = resolveChoiceOptions(effect, languages);
      if (offered && Array.isArray(picks) && picks.length <= effect.choose && new Set(picks).size === picks.length
        && picks.every(value => offered.includes(value))) picks.forEach(value => occupied.add(value));
    }
    return { ...choice, from: options.filter(value => !occupied.has(value)) };
  }
  if (["proficiency", "skill", "tool", "skill_proficiency"].includes(choice.grant_type)) {
    const remaining = { ...choices, resolved_choices: { ...choices.resolved_choices } };
    delete remaining.resolved_choices[choice.choice_id];
    const occupied = expertiseProficiencies(refs, remaining);
    return { ...choice, from: options.filter(value => !occupied.has(value.startsWith("skill-") || value === "thieves-tools" ? value : `skill-${value}`)) };
  }
  return { ...choice, from: [...options] };
}

export function resolveBuilderChoices<T extends { effects?: Effect[] }>(definition: T, refs: readonly BuilderClassRoleRef[],
  choices: CharacterChoices, languages?: readonly string[]): T {
  return { ...definition, effects: definition.effects?.map(effect => effect.type === "choice"
    ? resolveBuilderChoice(effect, refs, choices, languages) : effect) };
}
