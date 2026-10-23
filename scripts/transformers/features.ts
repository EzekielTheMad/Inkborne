import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect, buildChoiceEffect } from "./common";
import type { TransformedContent } from "./common";
import { referenceOptions, type ApiChoice } from "./api-options";
import type { Effect } from "@/lib/types/effects";

interface ApiFeature {
  index: string;
  name: string;
  class: { index: string; name: string };
  subclass?: { index: string; name: string };
  level: number;
  desc: string[];
  prerequisites: Array<unknown>;
  feature_specific?: { subfeature_options?: ApiChoice; expertise_options?: ApiChoice };
}

const SUBCLASS_FEATURES = new Set(["primal-path", "bard-college", "divine-domain", "druid-circle", "martial-archetype",
  "monastic-tradition", "sacred-oath", "ranger-archetype", "roguish-archetype", "sorcerous-origin", "otherworldly-patron", "arcane-tradition"]);

/** The level-one API encodes two skills OR one skill plus thieves' tools.
 * Distinct choose-two over that exact union preserves both alternatives. This
 * is deliberately separate from the generic reference mapper: other bundles
 * or nested cardinalities must not be silently flattened. */
function rogueExpertise(feature: ApiFeature): string[] | undefined {
  if (!["rogue-expertise-1", "rogue-expertise-2"].includes(feature.index)) return;
  const choice = feature.feature_specific?.expertise_options;
  const fail = () => { throw Error(`Unsupported SRD Rogue Expertise: ${feature.index}`); };
  if (feature.class.index !== "rogue" || feature.subclass || feature.level !== (feature.index === "rogue-expertise-1" ? 1 : 6) || !choice) return fail();
  const refs = (value: ApiChoice, count: number) => {
    if (value.choose !== count || !value.from.options?.every(option => option.option_type === "reference" && option.item)) return fail();
    return referenceOptions(value).map(option => option.index);
  };
  let options: string[];
  if (feature.level === 6) options = refs(choice, 2);
  else {
    const branches = choice.from.options;
    if (choice.choose !== 1 || branches?.length !== 2) return fail();
    const skillBranch = branches.find(option => option.option_type === "choice");
    const toolBranch = branches.find(option => option.option_type === "multiple");
    if (!skillBranch?.choice || toolBranch?.items?.length !== 2) return fail();
    const skillPick = toolBranch.items.find(option => option.option_type === "choice");
    const tool = toolBranch.items.find(option => option.option_type === "reference");
    if (!skillPick?.choice || tool?.item?.index !== "thieves-tools") return fail();
    const twoSkills = refs(skillBranch.choice, 2), oneSkill = refs(skillPick.choice, 1);
    if (twoSkills.length !== oneSkill.length || !twoSkills.every(skill => oneSkill.includes(skill))) return fail();
    options = [...twoSkills, "thieves-tools"];
  }
  if (options.length !== 19 || new Set(options).size !== 19 || options.filter(option => option.startsWith("skill-")).length !== 18
    || !options.includes("thieves-tools")) return fail();
  return options;
}

// Reviewed resource/mechanical constants are merged by buildContentEntry.
export function transformFeatureEntry(feature: ApiFeature): TransformedContent {
    const effects: Effect[] = [];
    if (feature.desc.length > 0) {
      effects.push(buildNarrativeEffect(feature.desc.join("\n"), "Class Feature"));
    }

    // Only the actual twelve subclass gates are subclass selectors. Names
    // such as "Domain Spells" or "Circle of the Land: Arctic" are not gates.
    const expertise = rogueExpertise(feature);
    let feature_type = "passive";
    if (expertise) {
      feature_type = "choice";
      effects.push(buildChoiceEffect(2, expertise, "expertise", feature.index));
    } else if (feature.name === "Ability Score Improvement") {
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
