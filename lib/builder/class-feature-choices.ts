import type { CharacterChoices } from "@/lib/types/character";
import type { ChoiceEffect, Effect } from "@/lib/types/effects";

export type ClassFeatureChoiceSource = { content_definitions?: {
  slug?: string; content_type?: string; effects?: Effect[];
} | null };

/** Additional picks earn new options, rather than another copy of an option
 * already owned by another active tier. Only valid, uniquely owned immutable
 * definitions may reserve an option. Database validation remains authoritative.
 */
export function resolveClassFeatureChoice(choice: ChoiceEffect, refs: readonly ClassFeatureChoiceSource[], choices: CharacterChoices): ChoiceEffect {
  if (!["feature", "favored_terrain"].includes(choice.grant_type)) return choice;
  const definitions = refs.flatMap(ref => ref.content_definitions?.effects ?? []).filter(effect => effect.type === "choice");
  const owners = (id: string) => definitions.filter(effect => effect.choice_id === id);
  if (!Array.isArray(choice.from) || owners(choice.choice_id).length !== 1) return { ...choice, from: [] };
  const occupied = new Set<string>();
  for (const other of definitions) {
    if (other.grant_type !== choice.grant_type || other.choice_id === choice.choice_id || owners(other.choice_id).length !== 1
      || !Array.isArray(other.from) || !Number.isInteger(other.choose) || other.choose < 1) continue;
    const selected = choices.resolved_choices?.[other.choice_id];
    if (!Array.isArray(selected) || selected.length > other.choose || new Set(selected).size !== selected.length
      || !selected.every(value => typeof value === "string" && other.from.includes(value))) continue;
    selected.forEach(value => occupied.add(value));
  }
  return { ...choice, from: choice.from.filter(value => !occupied.has(value)) };
}

export function resolveDefinitionClassFeatureChoices<T extends { effects?: Effect[] }>(definition: T,
  refs: readonly ClassFeatureChoiceSource[], choices: CharacterChoices): T {
  return { ...definition, effects: definition.effects?.map(effect => effect.type === "choice"
    ? resolveClassFeatureChoice(effect, refs, choices) : effect) };
}
