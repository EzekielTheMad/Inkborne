import { fetchAllFromApi, buildContentEntry, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect } from "@/lib/types/effects";

interface ApiBackground {
  index: string;
  name: string;
  starting_proficiencies: Array<{ index: string; name: string }>;
  language_options?: { choose: number; from: { options: Array<{ item: { index: string } }> } };
  starting_equipment: Array<{ equipment: { index: string; name: string }; quantity: number }>;
  starting_equipment_options: Array<unknown>;
  feature: { name: string; desc: string[] };
  personality_traits: { choose: number; from: { options: Array<{ string: string }> } };
  ideals: { choose: number; from: { options: Array<{ desc: string; alignments: Array<{ index: string }> }> } };
  bonds: { choose: number; from: { options: Array<{ string: string }> } };
  flaws: { choose: number; from: { options: Array<{ string: string }> } };
}

export async function transformBackgrounds(): Promise<TransformedContent[]> {
  const backgrounds = await fetchAllFromApi<ApiBackground>("/backgrounds");
  return backgrounds.map((bg) => {
    const effects: Effect[] = [];

    for (const prof of bg.starting_proficiencies) {
      effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
    }

    if (bg.language_options) {
      const opts = bg.language_options;
      const options = (opts.from?.options ?? []).map((o) => normalizeSlug(o.item.index));
      effects.push(buildChoiceEffect(opts.choose, options.length > 0 ? options : "all_languages", "language", `${bg.index}-language-choice`));
    }

    const personalityTraits = bg.personality_traits?.from?.options?.map((o) => o.string) ?? [];
    const ideals = bg.ideals?.from?.options?.map((o) => ({
      text: o.desc,
      alignment: o.alignments?.[0]?.index ?? "",
    })) ?? [];
    const bonds = bg.bonds?.from?.options?.map((o) => o.string) ?? [];
    const flaws = bg.flaws?.from?.options?.map((o) => o.string) ?? [];

    // Phase 3: extract skill proficiencies from API starting_proficiencies
    const skills = bg.starting_proficiencies
      .filter((p) => p.index.startsWith("skill-"))
      .map((p) => normalizeSlug(p.index.replace("skill-", "")));

    // Phase 3: extract tool proficiencies (non-skill proficiencies)
    const toolProfs = bg.starting_proficiencies
      .filter((p) => !p.index.startsWith("skill-"))
      .map((p) => normalizeSlug(p.index));

    // Phase 3: derive language proficiency data from language_options
    const languageProfs = bg.language_options
      ? [{ choose: bg.language_options.choose, from: "any" as const }]
      : [];

    return buildContentEntry("background", bg.index, bg.name, {
      feature: {
        name: bg.feature.name,
        description: bg.feature.desc.join("\n"),
      },
      personality_traits: personalityTraits,
      ideals,
      bonds,
      flaws,
      // Phase 3 fields
      skills,
      toolProfs,
      languageProfs,
      source_refs: [{ book: "SRD", page: 0 }],
      // gold and equipment are MPMB-seeded via SQL migration 00017
    }, effects);
  });
}
