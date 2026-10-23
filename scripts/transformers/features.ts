import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect } from "./common";
import type { TransformedContent } from "./common";
import { referenceOptions, type ApiChoice } from "./api-options";

interface ApiFeature {
  index: string;
  name: string;
  class: { index: string; name: string };
  subclass?: { index: string; name: string };
  level: number;
  desc: string[];
  prerequisites: Array<unknown>;
  feature_specific?: { subfeature_options?: ApiChoice };
}

const SUBCLASS_FEATURES = new Set(["primal-path", "bard-college", "divine-domain", "druid-circle", "martial-archetype",
  "monastic-tradition", "sacred-oath", "ranger-archetype", "roguish-archetype", "sorcerous-origin", "otherworldly-patron", "arcane-tradition"]);

// Reviewed resource/mechanical constants are merged by buildContentEntry.
export function transformFeatureEntry(feature: ApiFeature): TransformedContent {
    const effects = [];
    if (feature.desc.length > 0) {
      effects.push(buildNarrativeEffect(feature.desc.join("\n"), "Class Feature"));
    }

    // Only the actual twelve subclass gates are subclass selectors. Names
    // such as "Domain Spells" or "Circle of the Land: Arctic" are not gates.
    let feature_type = "passive";
    if (feature.name === "Ability Score Improvement") {
      feature_type = "asi";
    } else if (SUBCLASS_FEATURES.has(feature.index)) {
      feature_type = "subclass";
    } else if (feature.feature_specific?.subfeature_options && (feature.name === "Fighting Style" || feature.index === "additional-fighting-style")) {
      feature_type = "fighting_style";
    } else if (feature.feature_specific?.subfeature_options) {
      feature_type = "choice";
    }

    const choices = feature.feature_specific?.subfeature_options;
    return buildContentEntry("feature", feature.index, feature.name, {
      class: feature.class.index,
      subclass: feature.subclass?.index ?? null,
      level: feature.level,
      description: feature.desc.join("\n"),
      feature_type,
      ...(choices ? { choices: [{ name: feature.name, count: choices.choose,
        options: referenceOptions(choices).map(option => option.index) }] } : {}),
    }, effects);
}

export async function transformFeatures(): Promise<TransformedContent[]> {
  const features = await fetchAllFromApi<ApiFeature>("/features");
  return features.map(transformFeatureEntry);
}
