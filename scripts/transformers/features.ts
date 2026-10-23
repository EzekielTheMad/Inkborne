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
  feature_specific?: { subfeature_options?: ApiChoice; expertise_options?: ApiChoice;
    terrain_type_options?: { choose: number; type: string; from: { option_set_type: string; options: string[] } } };
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

/** Bard grants only existing skill proficiencies, never the Rogue's tool
 * alternative. Keep each earned tier's own source ID for persistence. */
function bardExpertise(feature: ApiFeature): string[] | undefined {
  const level = ({ "bard-expertise-1": 3, "bard-expertise-2": 10 } as Record<string, number>)[feature.index];
  if (!level) return;
  const choice = feature.feature_specific?.expertise_options;
  const fail = () => { throw Error(`Unsupported SRD Bard Expertise: ${feature.index}`); };
  if (feature.class.index !== "bard" || feature.subclass || feature.level !== level || !choice || choice.choose !== 2
    || !choice.from.options?.every(option => option.option_type === "reference" && option.item)) return fail();
  const options = referenceOptions(choice).map(option => option.index);
  const skills = ["acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
    "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival"];
  if (options.length !== skills.length || !skills.every(skill => options.includes(`skill-${skill}`))) return fail();
  return options;
}

/** Each later Natural Explorer tier earns one additional terrain. The API
 * title's cumulative count is not the number gained by this occurrence. */
function rangerTerrain(feature: ApiFeature): string[] | undefined {
  const level = ({ "natural-explorer-1-terrain-type": 1, "natural-explorer-2-terrain-types": 6,
    "natural-explorer-3-terrain-types": 10 } as Record<string, number>)[feature.index];
  if (!level) return;
  const choice = feature.feature_specific?.terrain_type_options;
  const options = ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"];
  if (feature.class.index !== "ranger" || feature.subclass || feature.level !== level || choice?.choose !== 1
    || choice.type !== "string" || choice.from.option_set_type !== "options_array"
    || choice.from.options.length !== options.length || new Set(choice.from.options).size !== options.length
    || !options.every(option => choice.from.options.includes(option))) throw Error(`Unsupported SRD Natural Explorer: ${feature.index}`);
  return [...choice.from.options];
}

// Reviewed resource/mechanical constants are merged by buildContentEntry.
export function transformFeatureEntry(feature: ApiFeature): TransformedContent {
    const effects: Effect[] = [];
    if (feature.desc.length > 0) {
      effects.push(buildNarrativeEffect(feature.desc.join("\n"), "Class Feature"));
    }

    // Only the actual twelve subclass gates are subclass selectors. Names
    // such as "Domain Spells" or "Circle of the Land: Arctic" are not gates.
    const expertise = rogueExpertise(feature) ?? bardExpertise(feature);
    const terrain = rangerTerrain(feature);
    let feature_type = "passive";
    if (expertise) {
      feature_type = "choice";
      effects.push(buildChoiceEffect(2, expertise, "expertise", feature.index));
    } else if (terrain) {
      feature_type = "choice";
      effects.push(buildChoiceEffect(1, terrain, "favored_terrain", feature.index));
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
