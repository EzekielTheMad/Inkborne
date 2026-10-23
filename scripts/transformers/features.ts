import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect, buildChoiceEffect } from "./common";
import type { TransformedContent } from "./common";
import { referenceOptions, type ApiChoice, type ApiReference } from "./api-options";
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
    terrain_type_options?: { choose: number; type: string; from: { option_set_type: string; options: string[] } };
    enemy_type_options?: { choose: number; type: string; from: { option_set_type: string; options: string[] } };
    invocations?: ApiReference[] };
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

function rangerEnemies(feature: ApiFeature): Record<string, string[]> | undefined {
  const level = ({ "favored-enemy-1-type": 1, "favored-enemy-2-types": 6, "favored-enemy-3-enemies": 14 } as Record<string, number>)[feature.index];
  if (!level) return;
  const choice = feature.feature_specific?.enemy_type_options;
  const enemy_types = ["aberrations", "beasts", "celestials", "constructs", "dragons", "elementals", "fey", "fiends", "giants",
    "monstrosities", "oozes", "plants", "undead"];
  const expected = [...enemy_types, "humanoids"];
  if (feature.class.index !== "ranger" || feature.subclass || feature.level !== level || choice?.choose !== 1 || choice.type !== "string"
    || choice.from.option_set_type !== "options_array" || choice.from.options.length !== expected.length
    || new Set(choice.from.options).size !== expected.length || !expected.every(option => choice.from.options.includes(option))) {
    throw Error(`Unsupported SRD Favored Enemy: ${feature.index}`);
  }
  // This finite humanoid subset is explicit in the product UI. The source's
  // example gnolls/orcs and the nine SRD player races are not an exhaustive
  // taxonomy of every humanoid in every campaign.
  return { enemy_types, humanoid_races: ["dragonborn", "dwarf", "elf", "gnoll", "gnome", "half-elf", "half-orc", "halfling", "human", "orc", "tiefling"] };
}

function invocationPrerequisites(feature: ApiFeature): Record<string, unknown>[] | undefined {
  if (!feature.index.startsWith("eldritch-invocation-")) return;
  if (feature.class.index !== "warlock" || feature.subclass || !Number.isInteger(feature.level)
    || feature.level < 2 || feature.level > 20) throw Error(`Unsupported SRD invocation: ${feature.index}`);
  const requirements: Record<string, unknown>[] = [{ kind: "class_level", minimum: feature.level }];
  for (const entry of feature.prerequisites) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw Error(`Unsupported SRD invocation prerequisite: ${feature.index}`);
    const prerequisite = entry as Record<string, unknown>;
    if (prerequisite.type === "level" && prerequisite.level === feature.level) continue;
    if (["spell", "feature"].includes(String(prerequisite.type))) {
      const kind = prerequisite.type as "spell" | "feature";
      const value = prerequisite[kind];
      const match = typeof value === "string" && value.match(new RegExp(`^/api/2014/${kind}s/([a-z0-9-]+)$`));
      if (match) { requirements.push({ kind, slug: match[1] }); continue; }
    }
    throw Error(`Unsupported SRD invocation prerequisite: ${feature.index}`);
  }
  return requirements;
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
    const favored_enemy = rangerEnemies(feature);
    const selection_prerequisites = invocationPrerequisites(feature);
    let feature_type = "passive";
    if (expertise) {
      feature_type = "choice";
      effects.push(buildChoiceEffect(2, expertise, "expertise", feature.index));
    } else if (terrain) {
      feature_type = "choice";
      effects.push(buildChoiceEffect(1, terrain, "favored_terrain", feature.index));
    } else if (favored_enemy) {
      feature_type = "favored_enemy";
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
    if (choices && feature_type === "choice") {
      // A referenced option is a real immutable child feature, not a label
      // whose mechanics can be reconstructed from a saved string.
      if (!choices.from.options?.every(option => option.option_type === "reference" && option.item)) {
        throw Error(`Unsupported SRD feature choice: ${feature.index}`);
      }
      const options = referenceOptions(choices).map(option => option.index);
      if (/^metamagic-[123]$/.test(feature.index)
        && (feature.class.index !== "sorcerer" || choices.choose !== (feature.index === "metamagic-1" ? 2 : 1)
          || feature.level !== ({ "metamagic-1": 3, "metamagic-2": 10, "metamagic-3": 17 } as Record<string, number>)[feature.index]
          || options.length !== 8 || options.some(option => !option.startsWith("metamagic-")))) {
        throw Error(`Unsupported SRD Metamagic: ${feature.index}`);
      }
      effects.push(buildChoiceEffect(choices.choose, options, "feature", feature.index));
    }
    const invocations = feature.index === "eldritch-invocations" ? feature.feature_specific?.invocations : undefined;
    if (feature.index === "eldritch-invocations" && !invocations) throw Error("Unsupported SRD Eldritch Invocations");
    if (invocations) {
      if (feature.class.index !== "warlock" || feature.level !== 2 || invocations.length !== 32
        || new Set(invocations.map(option => option.index)).size !== 32
        || invocations.some(option => !option.index.startsWith("eldritch-invocation-"))) throw Error("Unsupported SRD Eldritch Invocations");
      feature_type = "choice";
      effects.push(buildChoiceEffect(2, invocations.map(option => option.index), "invocation", feature.index));
    }
    return buildContentEntry("feature", feature.index, feature.name, {
      class: feature.class.index,
      subclass: feature.subclass?.index ?? null,
      level: feature.level,
      description: feature.desc.join("\n"),
      feature_type,
      ...(selection_prerequisites ? { selection_prerequisites } : {}),
      ...(favored_enemy ? { favored_enemy } : {}),
      ...(choices ? { choices: [{ name: feature.name, count: choices.choose,
        options: referenceOptions(choices).map(option => option.index) }] } : invocations
        ? { choices: [{ name: feature.name, count: 2, options: invocations.map(option => option.index) }] } : {}),
    }, effects);
}

export async function transformFeatures(): Promise<TransformedContent[]> {
  const features = await fetchAllFromApi<ApiFeature>("/features");
  return features.map(transformFeatureEntry);
}
