import { fetchAllFromApi, buildContentEntry, buildMechanicalEffect, buildAbilityBonusEffects, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect } from "@/lib/types/effects";

interface ApiRace {
  index: string;
  name: string;
  speed: number;
  ability_bonuses: Array<{ ability_score: { index: string; name: string }; bonus: number }>;
  size: string;
  size_description: string;
  age: string;
  alignment: string;
  languages: Array<{ index: string; name: string }>;
  language_desc: string;
  traits: Array<{ index: string; name: string }>;
  subraces: Array<{ index: string; name: string }>;
  starting_proficiencies: Array<{ index: string; name: string }>;
  starting_proficiency_options?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
  language_options?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
}

export function transformRaceEntry(apiRace: ApiRace): TransformedContent {
  const effects: Effect[] = [];

  // Ability bonuses
  effects.push(...buildAbilityBonusEffects(apiRace.ability_bonuses));

  // Speed
  effects.push(buildMechanicalEffect("movement_speed", "set", apiRace.speed));

  // Size
  effects.push(buildMechanicalEffect("size", "set", apiRace.size));

  // Starting proficiency grants
  for (const prof of (apiRace.starting_proficiencies ?? [])) {
    effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
  }

  // Proficiency choices
  if (apiRace.starting_proficiency_options) {
    const opts = apiRace.starting_proficiency_options;
    const options = opts.from.options.map((o) => normalizeSlug(o.item.index));
    effects.push(buildChoiceEffect(opts.choose, options, "proficiency", `${apiRace.index}-proficiency-choice`));
  }

  // Language choices
  if (apiRace.language_options) {
    const opts = apiRace.language_options;
    const options = opts.from.options.map((o) => normalizeSlug(o.item.index));
    effects.push(buildChoiceEffect(opts.choose, options, "language", `${apiRace.index}-language-choice`));
  }

  return buildContentEntry("race", apiRace.index, apiRace.name, {
    size: apiRace.size,
    speed: apiRace.speed,
    age_description: apiRace.age,
    alignment_description: apiRace.alignment,
    size_description: apiRace.size_description,
    language_description: apiRace.language_desc,
    traits: (apiRace.traits ?? []).map((t) => t.index),
    subraces: (apiRace.subraces ?? []).map((s) => s.index),
    languages: (apiRace.languages ?? []).map((l) => l.index),
  }, effects);
}

interface ApiSubrace {
  index: string;
  name: string;
  desc: string;
  race: { index: string; name: string };
  ability_bonuses: Array<{ ability_score: { index: string; name: string }; bonus: number }>;
  racial_traits: Array<{ index: string; name: string }>;
  starting_proficiencies: Array<{ index: string; name: string }>;
  languages: Array<{ index: string; name: string }>;
  language_options?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
}

export function transformSubraceEntry(apiSubrace: ApiSubrace): TransformedContent {
  const effects: Effect[] = [];

  effects.push(...buildAbilityBonusEffects(apiSubrace.ability_bonuses));

  for (const prof of (apiSubrace.starting_proficiencies ?? [])) {
    effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
  }

  if (apiSubrace.language_options) {
    const opts = apiSubrace.language_options;
    const options = opts.from.options.map((o) => normalizeSlug(o.item.index));
    effects.push(buildChoiceEffect(opts.choose, options, "language", `${apiSubrace.index}-language-choice`));
  }

  return buildContentEntry("subrace", apiSubrace.index, apiSubrace.name, {
    parent_race: apiSubrace.race.index,
    description: apiSubrace.desc,
    traits: (apiSubrace.racial_traits ?? []).map((t) => t.index),
    languages: (apiSubrace.languages ?? []).map((l) => l.index),
  }, effects);
}

export async function transformRaces(): Promise<TransformedContent[]> {
  const races = await fetchAllFromApi<ApiRace>("/races");
  const subraces = await fetchAllFromApi<ApiSubrace>("/subraces");
  return [
    ...races.map(transformRaceEntry),
    ...subraces.map(transformSubraceEntry),
  ];
}
