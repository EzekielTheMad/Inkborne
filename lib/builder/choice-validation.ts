import type { ChoiceEffect, Effect } from "@/lib/types/effects";
import type { AsiChoice } from "@/lib/types/character";

/** Only resolve category vocabulary backed by existing content. Unknown sources
 * stay unavailable; saved strings alone never prove that a choice is valid. */
export function isLanguageChoiceCategory(choice: ChoiceEffect): boolean {
  return choice.from === "all_languages" || (choice.from === "any" && choice.grant_type === "language");
}

export function resolveChoiceOptions(choice: ChoiceEffect, languages?: readonly string[], fixedLanguages: readonly string[] = []): readonly string[] | undefined {
  if (Array.isArray(choice.from)) return [...new Set(choice.from)];
  if (!isLanguageChoiceCategory(choice) || languages === undefined) return undefined;
  return [...new Set(languages)].filter(language => !fixedLanguages.includes(language));
}

export function isChoiceComplete(choice: ChoiceEffect, selections: unknown, languages?: readonly string[], fixedLanguages: readonly string[] = []): boolean {
  const options = resolveChoiceOptions(choice, languages, fixedLanguages);
  return !!options && Number.isInteger(choice.choose) && choice.choose > 0 && !!choice.choice_id &&
    Array.isArray(selections) && selections.length === choice.choose &&
    new Set(selections).size === selections.length && selections.every(value => typeof value === "string" && options.includes(value));
}

export function fixedLanguages(definitions: readonly { data: Record<string, unknown>; effects?: Effect[] }[]): string[] {
  return [...new Set(definitions.flatMap(definition => [
    ...[definition.data.languages, definition.data.languageProfs].flatMap(values => Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []),
    ...(definition.effects ?? []).flatMap(effect => effect.type === "grant" &&
      (effect.stat === "language" || effect.stat === "languages") && typeof effect.value === "string" ? [effect.value] : []),
  ]))];
}

export function resolveDefinitionChoices<T extends { effects?: Effect[] }>(definition: T, languages?: readonly string[], granted: readonly string[] = []): T {
  return { ...definition, effects: definition.effects?.map(effect => {
    if (effect.type !== "choice" || Array.isArray(effect.from)) return effect;
    const options = resolveChoiceOptions(effect, languages, granted);
    return options ? { ...effect, from: [...options] } : effect;
  }) };
}

/** Saved shape only; feat ownership/version and prerequisites are separate checks. */
export function isAsiChoiceComplete(choice: AsiChoice | undefined): boolean {
  if (choice?.mode === "feat") return typeof choice.featId === "string" && !!choice.featId.trim() &&
    Number.isInteger(choice.featVersion) && choice.featVersion > 0;
  if (choice?.mode !== "asi" || !Array.isArray(choice.allocations) ||
    choice.allocations.length < 1 || choice.allocations.length > 2 ||
    !choice.allocations.every(allocation => allocation && typeof allocation === "object")) return false;
  const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  return new Set(choice.allocations.map(allocation => allocation.ability)).size === choice.allocations.length &&
    choice.allocations.every(allocation => abilities.includes(allocation.ability) && (allocation.amount === 1 || allocation.amount === 2)) &&
    choice.allocations.reduce((total, allocation) => total + allocation.amount, 0) === 2;
}

export function activeFeatureSlugs(definition: { data: Record<string, unknown> }, level: number): string[] {
  const rows = definition.data.levels;
  if (!Array.isArray(rows)) return [];
  return [...new Set(rows.flatMap(row => row && Number.isInteger(row.level) && row.level > 0 && row.level <= level && Array.isArray(row.features)
    ? row.features.filter((slug: unknown): slug is string => typeof slug === "string") : []))] as string[];
}

export function fightingStyleSlugs(definition: { data: Record<string, unknown> }): string[] {
  if (definition.data.feature_type !== "fighting_style" || !Array.isArray(definition.data.choices)) return [];
  return [...new Set(definition.data.choices.flatMap(choice => choice && Array.isArray(choice.options)
    ? choice.options.filter((slug: unknown): slug is string => typeof slug === "string") : []))] as string[];
}
