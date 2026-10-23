import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import { referenceOptions, type ApiChoice } from "./api-options";

interface ApiTrait {
  index: string;
  name: string;
  desc: string[];
  races: Array<{ index: string; name: string }>;
  subraces: Array<{ index: string; name: string }>;
  proficiencies: Array<{ index: string; name: string }>;
  proficiency_choices?: {
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  };
  trait_specific?: {
    spell_options?: ApiChoice;
    subtrait_options?: ApiChoice;
    damage_type?: { index: string };
    breath_weapon?: { usage: { type: string; times: number } };
  };
}

export function transformTraitEntry(trait: ApiTrait): TransformedContent {
    const effects = [];

    // Proficiency grants
    for (const prof of trait.proficiencies) {
      effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
    }

    // Proficiency choices
    if (trait.proficiency_choices) {
      const options = trait.proficiency_choices.from.options.map((o) => normalizeSlug(o.item.index));
      effects.push(buildChoiceEffect(
        trait.proficiency_choices.choose,
        options,
        "proficiency",
        `${trait.index}-proficiency-choice`
      ));
    }

    const spells = trait.trait_specific?.spell_options;
    if (spells) effects.push(buildChoiceEffect(spells.choose, referenceOptions(spells).map(option => option.index),
      "spell", `${trait.index}-spell-choice`));
    if (trait.index === "high-elf-cantrip") effects.push(buildGrantEffect("spellcasting_ability", "intelligence"));
    const subtraits = trait.trait_specific?.subtrait_options;
    if (subtraits) effects.push(buildChoiceEffect(subtraits.choose, referenceOptions(subtraits).map(option => option.index),
      "trait", `${trait.index}-trait-choice`));
    if (trait.trait_specific?.damage_type) effects.push(buildGrantEffect("dmgres", trait.trait_specific.damage_type.index));

    // Description as narrative
    if (trait.desc.length > 0) {
      effects.push(buildNarrativeEffect(trait.desc.join("\n"), "Racial Trait"));
    }

    return buildContentEntry("trait", trait.index, trait.name, {
      description: trait.desc.join("\n"),
      races: trait.races.map((r) => r.index),
      subraces: trait.subraces.map((r) => r.index),
      ...(trait.trait_specific?.breath_weapon ? { usages: trait.trait_specific.breath_weapon.usage.times, recovery: "short rest" } : {}),
      ...(trait.index === "relentless-endurance" ? { usages: 1, recovery: "long rest" } : {}),
    }, effects);
}

export async function transformTraits(): Promise<TransformedContent[]> {
  const traits = await fetchAllFromApi<ApiTrait>("/traits");
  return traits.map(transformTraitEntry);
}
