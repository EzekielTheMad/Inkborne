import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";

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
}

export async function transformTraits(): Promise<TransformedContent[]> {
  const traits = await fetchAllFromApi<ApiTrait>("/traits");
  return traits.map((trait) => {
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

    // Description as narrative
    if (trait.desc.length > 0) {
      effects.push(buildNarrativeEffect(trait.desc.join("\n"), "Racial Trait"));
    }

    return buildContentEntry("trait", trait.index, trait.name, {
      description: trait.desc.join("\n"),
      races: trait.races.map((r) => r.index),
      subraces: trait.subraces.map((r) => r.index),
    }, effects);
  });
}
