import { fetchAllFromApi, buildContentEntry, buildGrantEffect, buildChoiceEffect, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect } from "@/lib/types/effects";
import { referenceOptions, startingEquipmentText, type ApiChoice } from "./api-options";

interface ApiBackground {
  index: string;
  name: string;
  starting_proficiencies: Array<{ index: string; name: string }>;
  language_options?: ApiChoice;
  starting_equipment: Array<{ equipment: { index: string; name: string }; quantity: number }>;
  starting_equipment_options: ApiChoice[];
  starting_gold?: { quantity: number; unit: string };
  feature: { name: string; desc: string[] };
  personality_traits: { choose: number; from: { options: Array<{ string: string }> } };
  ideals: { choose: number; from: { options: Array<{ desc: string; alignments: Array<{ index: string }> }> } };
  bonds: { choose: number; from: { options: Array<{ string: string }> } };
  flaws: { choose: number; from: { options: Array<{ string: string }> } };
}

export function transformBackgroundEntry(bg: ApiBackground): TransformedContent {
    const effects: Effect[] = [];

    for (const prof of bg.starting_proficiencies) {
      effects.push(buildGrantEffect(normalizeSlug(prof.index), "proficient"));
    }

    if (bg.language_options) {
      const opts = bg.language_options;
      const options = (opts.from.options?.length ? referenceOptions(opts) : []).map((o) => normalizeSlug(o.index));
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

    let equipment = bg.starting_equipment;
    if (bg.starting_gold) {
      if (!Number.isSafeInteger(bg.starting_gold.quantity) || bg.starting_gold.quantity < 0 || !["cp", "sp", "ep", "gp", "pp"].includes(bg.starting_gold.unit)
        || bg.starting_equipment.filter(item => item.equipment.index === "pouch" && item.quantity === 1).length !== 1) {
        throw new Error(`Unsupported SRD background starting-currency source: ${bg.index}`);
      }
      equipment = bg.starting_equipment.map(item => item.equipment.index === "pouch"
        ? { ...item, equipment: { ...item.equipment, name: `Pouch containing ${bg.starting_gold!.quantity} ${bg.starting_gold!.unit}` } }
        : item);
    }
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
      gold: bg.starting_gold?.unit === "gp" ? bg.starting_gold.quantity : undefined,
      // Currency is in the trusted equipment plan exactly once. `gold` is
      // descriptive metadata; the award compiler consumes only this text.
      equipment: startingEquipmentText(equipment, bg.starting_equipment_options, ", "),
    }, effects);
}

export async function transformBackgrounds(): Promise<TransformedContent[]> {
  const backgrounds = await fetchAllFromApi<ApiBackground>("/backgrounds");
  return backgrounds.map(transformBackgroundEntry);
}
