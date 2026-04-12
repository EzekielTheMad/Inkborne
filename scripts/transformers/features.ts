import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect } from "./common";
import type { TransformedContent } from "./common";

interface ApiFeature {
  index: string;
  name: string;
  class: { index: string; name: string };
  subclass?: { index: string; name: string };
  level: number;
  desc: string[];
  prerequisites: Array<unknown>;
}

// TODO: Phase 1 mechanical fields (action, usages, recovery, additional, speed,
// vision, dmgres, savetxt, scores, extraAC) are seeded from MPMB data via SQL
// migration 00012_mpmb_feature_enrichment.sql. The dnd5eapi API does not provide
// these fields, so the transformer cannot populate them from the API.
export async function transformFeatures(): Promise<TransformedContent[]> {
  const features = await fetchAllFromApi<ApiFeature>("/features");
  return features.map((feature) => {
    const effects = [];
    if (feature.desc.length > 0) {
      effects.push(buildNarrativeEffect(feature.desc.join("\n"), "Class Feature"));
    }

    // Determine feature_type based on name/content
    let feature_type = "passive";
    if (feature.name === "Ability Score Improvement") {
      feature_type = "asi";
    } else if (
      feature.name.includes("Archetype") ||
      feature.name.includes("Tradition") ||
      feature.name.includes("Sacred Oath") ||
      feature.name.includes("Patron") ||
      feature.name.includes("Circle") ||
      feature.name.includes("Domain") ||
      feature.name.includes("College") ||
      feature.name.includes("Monastic") ||
      feature.name.includes("Primal Path") ||
      feature.name.includes("Sorcerous Origin") ||
      feature.name.includes("Roguish Archetype") ||
      feature.name.includes("Ranger Archetype")
    ) {
      feature_type = "subclass";
    } else if (feature.name.startsWith("Fighting Style")) {
      feature_type = "fighting_style";
    }

    return buildContentEntry("feature", feature.index, feature.name, {
      class: feature.class.index,
      subclass: feature.subclass?.index ?? null,
      level: feature.level,
      description: feature.desc.join("\n"),
      feature_type,
    }, effects);
  });
}
