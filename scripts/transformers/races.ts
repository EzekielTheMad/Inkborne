import { fetchFromApi, fetchAllFromApi, buildContentEntry, buildMechanicalEffect, buildAbilityBonusEffects, buildGrantEffect, buildChoiceEffect, normalizeSlug, expandAbilityAbbreviation } from "./common";
import type { TransformedContent } from "./common";
import type { Effect } from "@/lib/types/effects";

interface ApiRace {
  index: string;
  name: string;
  speed: number;
  ability_bonuses: Array<{ ability_score: { index: string; name: string }; bonus: number }>;
  ability_bonus_options?: { choose: number; from: { options: Array<{ ability_score: { index: string }; bonus: number }> } };
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

// Known weapon proficiency indices from the API
const WEAPON_PROF_PREFIXES = ["weapon-", "battleaxes", "handaxes", "light-hammers", "warhammers", "longswords", "shortswords", "rapiers", "hand-crossbows"];
const ARMOR_PROF_PREFIXES = ["armor-", "light-armor", "medium-armor", "heavy-armor", "shields"];
const TOOL_PROF_PREFIXES = ["smiths-tools", "brewers-supplies", "masons-tools", "tinkers-tools", "alchemists-supplies", "painters-supplies", "navigators-tools"];

function categorizeProficiency(index: string): "weapon" | "armor" | "tool" | "other" {
  const slug = index.toLowerCase();
  if (WEAPON_PROF_PREFIXES.some((p) => slug.includes(p))) return "weapon";
  if (ARMOR_PROF_PREFIXES.some((p) => slug.includes(p))) return "armor";
  if (TOOL_PROF_PREFIXES.some((p) => slug.includes(p))) return "tool";
  return "other";
}

export function transformRaceEntry(apiRace: ApiRace): TransformedContent {
  const effects: Effect[] = [];

  // Ability bonuses
  effects.push(...buildAbilityBonusEffects(apiRace.ability_bonuses));
  if (apiRace.ability_bonus_options) {
    const choice = apiRace.ability_bonus_options;
    if (choice.from.options.some(option => option.bonus !== 1)) throw new Error("Unsupported nonuniform SRD ability bonus choice.");
    effects.push(buildChoiceEffect(choice.choose, choice.from.options.map(option => expandAbilityAbbreviation(option.ability_score.index)),
      "ability_bonus", `${apiRace.index}-ability-bonus-choice`));
  }

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

  // Categorize starting proficiencies
  const weaponProfs: string[] = [];
  const armorProfs: string[] = [];
  const toolProfs: string[] = [];
  for (const prof of (apiRace.starting_proficiencies ?? [])) {
    const category = categorizeProficiency(prof.index);
    const slug = normalizeSlug(prof.index);
    switch (category) {
      case "weapon": weaponProfs.push(slug); break;
      case "armor": armorProfs.push(slug); break;
      case "tool": toolProfs.push(slug); break;
    }
  }

  return buildContentEntry("race", apiRace.index, apiRace.name, {
    size: apiRace.size,
    speed: apiRace.speed,
    speed_detail: { walk: apiRace.speed },
    ability_score_representation: { version: 1, mode: "effects" },
    age_description: apiRace.age,
    alignment_description: apiRace.alignment,
    size_description: apiRace.size_description,
    language_description: apiRace.language_desc,
    traits: (apiRace.traits ?? []).map((t) => t.index),
    subraces: (apiRace.subraces ?? []).map((s) => s.index),
    languages: (apiRace.languages ?? []).map((l) => l.index),
    weaponProfs,
    armorProfs,
    toolProfs,
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

interface ApiSubraceHitPoints {
  index: string; name: string; desc: string[]; races: Array<{ index: string }>; subraces: Array<{ index: string }>;
}

/** Publish the reviewed mechanic on a meaningful new root, keeping its genuine
 * trait unchanged. Older pinned roots retain their original data and behavior.
 */
export function subraceHitPointMechanics(subrace: Pick<ApiSubrace, "index" | "race" | "racial_traits">,
  trait?: ApiSubraceHitPoints): Record<string, unknown> {
  if (subrace.index !== "hill-dwarf") return {};
  if (subrace.race.index !== "dwarf" || subrace.racial_traits.filter(entry => entry.index === "dwarven-toughness").length !== 1
    || trait?.index !== "dwarven-toughness" || trait.name !== "Dwarven Toughness"
    || JSON.stringify(trait.desc) !== JSON.stringify(["Your hit point maximum increases by 1, and it increases by 1 every time you gain a level."])
    || !Array.isArray(trait.races) || trait.races.length !== 0 || !Array.isArray(trait.subraces)
    || trait.subraces.length !== 1 || trait.subraces[0]?.index !== "hill-dwarf") {
    throw Error("The genuine SRD Dwarven Toughness source is unavailable or changed");
  }
  return { hit_points_bonus_per_character_level: 1 };
}

export function transformSubraceEntry(apiSubrace: ApiSubrace, hitPointTrait?: ApiSubraceHitPoints): TransformedContent {
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
    ...subraceHitPointMechanics(apiSubrace, hitPointTrait),
    parent_race: apiSubrace.race.index,
    description: apiSubrace.desc,
    traits: (apiSubrace.racial_traits ?? []).map((t) => t.index),
    languages: (apiSubrace.languages ?? []).map((l) => l.index),
  }, effects);
}

export async function transformRaces(): Promise<TransformedContent[]> {
  const races = await fetchAllFromApi<ApiRace>("/races");
  const subraces = await fetchAllFromApi<ApiSubrace>("/subraces");
  const hitPointTrait = subraces.some(subrace => subrace.index === "hill-dwarf")
    ? await fetchFromApi<ApiSubraceHitPoints>("/traits/dwarven-toughness") : undefined;
  return [
    ...races.map(transformRaceEntry),
    ...subraces.map(subrace => transformSubraceEntry(subrace, hitPointTrait)),
  ];
}
