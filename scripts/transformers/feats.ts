import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect, expandAbilityAbbreviation } from "./common";
import type { TransformedContent } from "./common";
import type { StatCondition } from "@/lib/types/effects";

interface ApiFeat {
  index: string;
  name: string;
  desc: string[];
  prerequisites: Array<{ ability_score?: { index: string }; minimum_score?: number }>;
}

export async function transformFeats(): Promise<TransformedContent[]> {
  const feats = await fetchAllFromApi<ApiFeat>("/feats");
  return feats.map((feat) => {
    const prerequisites: StatCondition[] = feat.prerequisites
      .filter((p) => p.ability_score && p.minimum_score)
      .map((p) => ({
        stat: expandAbilityAbbreviation(p.ability_score!.index),
        op: "gte" as const,
        value: p.minimum_score!,
      }));

    const effects = [];
    if (feat.desc.length > 0) {
      effects.push(buildNarrativeEffect(feat.desc.join("\n"), "Feat"));
    }

    // Phase 3: add source_refs from transformer; all other mechanical fields
    // (scores, action, usages, recovery, speed, vision, dmgres, savetxt,
    // proficiencies, extraAC, spellcastingBonus, calcChanges, addMod) are
    // populated via SQL migration 00016 or via homebrew creation UI.
    return buildContentEntry("feat", feat.index, feat.name, {
      description: feat.desc.join("\n"),
      prerequisites,
      source_refs: [{ book: "SRD", page: 0 }],
    }, effects);
  });
}
