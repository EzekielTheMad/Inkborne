import { fetchFromApi, fetchAllFromApi, buildContentEntry, buildNarrativeEffect, buildChoiceEffect, buildGrantEffect } from "./common";
import type { TransformedContent } from "./common";
import { referenceOptions, type ApiChoice, type ApiReference } from "./api-options";
import type { Effect } from "@/lib/types/effects";
import type { BonusSpellChoice, BonusSpellGrant } from "@/lib/builder/bonus-spells";

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

const SKILLS = ["acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
  "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival"];
const LAND_TERRAINS = ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"];

function loreSkills(feature: ApiFeature): string[] | undefined {
  if (feature.index !== "bonus-proficiencies") return;
  if (feature.class.index !== "bard" || feature.subclass?.index !== "lore" || feature.level !== 3
    || !/proficiency with three skills of your choice/i.test(feature.desc.join(" "))) {
    throw Error("Unsupported SRD Lore Bonus Proficiencies");
  }
  return SKILLS.map(skill => `skill-${skill}`);
}

/** These finite policies are evidenced by the identified 2014 feature prose.
 * The class's own published progression supplies a dynamic maximum, while
 * every other filter and budget rule stays explicit in the immutable feature. */
function bonusSpells(feature: ApiFeature): BonusSpellChoice[] | undefined {
  const text = feature.desc.join(" ");
  const base = (overrides: Partial<BonusSpellChoice> = {}): BonusSpellChoice => ({
    choice_id: feature.index, choose: 1, min_spell_level: 0, max_spell_level: "class", list_class: null,
    ritual_only: false, spellbook_only: false, counts_known: false, always_prepared: false, mode: "known", ...overrides,
  });
  const assert = (classSlug: string, level: number, subclass: string | null, evidence: RegExp) => {
    if (feature.class.index !== classSlug || feature.level !== level || (feature.subclass?.index ?? null) !== subclass
      || !evidence.test(text)) throw Error(`Unsupported SRD bonus spells: ${feature.index}`);
  };
  if (feature.index === "bonus-cantrip") {
    assert("druid", 2, "land", /one additional druid cantrip of your choice/i);
    return [base({ max_spell_level: 0, list_class: "druid" })];
  }
  if (/^magical-secrets-[123]$/.test(feature.index)) {
    assert("bard", ({ "magical-secrets-1": 10, "magical-secrets-2": 14, "magical-secrets-3": 18 } as Record<string, number>)[feature.index], null,
      /Choose two spells from any class[\s\S]*included in the number in the Spells Known column/i);
    return [base({ choose: 2, counts_known: true })];
  }
  if (feature.index === "additional-magical-secrets") {
    assert("bard", 6, "lore", /two spells of your choice from any class[\s\S]*don't count against the number of bard spells you know/i);
    return [base({ choose: 2 })];
  }
  if (feature.index === "pact-of-the-tome") {
    assert("warlock", 3, null, /choose three cantrips from any class's spell list[\s\S]*don't count against your number of cantrips known/i);
    return [base({ choose: 3, max_spell_level: 0 })];
  }
  if (feature.index === "eldritch-invocation-book-of-ancient-secrets") {
    assert("warlock", 2, null, /Choose two 1st-level spells that have the ritual tag from any class's spell list[\s\S]*except as rituals/i);
    if (!feature.prerequisites.some(value => !!value && typeof value === "object"
      && (value as Record<string, unknown>).type === "feature"
      && (value as Record<string, unknown>).feature === "/api/2014/features/pact-of-the-tome")) {
      throw Error(`Unsupported SRD bonus spell prerequisite: ${feature.index}`);
    }
    return [base({ choose: 2, min_spell_level: 1, max_spell_level: 1, ritual_only: true, mode: "ritual" })];
  }
  const arcanum = feature.index.match(/^mystic-arcanum-([6-9])th-level$/);
  if (arcanum) {
    const spellLevel = Number(arcanum[1]);
    assert("warlock", spellLevel * 2 - 1, null, /Choose one 6th- level spell from the warlock spell list[\s\S]*one 9th-level spell at 17th level/i);
    return [base({ min_spell_level: spellLevel, max_spell_level: spellLevel, list_class: "warlock", mode: "arcanum" })];
  }
  if (feature.index === "spell-mastery") {
    assert("wizard", 18, null, /a 1st-level wizard spell and a 2nd-level wizard spell that are in your spellbook[\s\S]*when you have them prepared/i);
    return [1, 2].map(level => base({ choice_id: `spell-mastery-${level}`, min_spell_level: level, max_spell_level: level,
      list_class: "wizard", spellbook_only: true, mode: "mastery" }));
  }
  if (feature.index === "signature-spell") {
    assert("wizard", 20, null, /two 3rd-level wizard spells in your spellbook[\s\S]*always have these spells prepared[\s\S]*don't count against the number of spells you have prepared/i);
    return [base({ choose: 2, min_spell_level: 3, max_spell_level: 3, list_class: "wizard", spellbook_only: true,
      always_prepared: true, mode: "signature" })];
  }
}

interface ApiLandSpellSource {
  index: string; class: { index: string };
  spells: Array<{ spell: { index: string }; prerequisites: Array<{ type: string; index: string }> }>;
}

/** The API puts the terrain/level predicates on the subclass spell edges,
 * rather than the terrain feature. Preserve both predicates when attaching
 * those genuine source edges to each chosen immutable terrain child. */
export function transformLandSpellGrants(source: ApiLandSpellSource): Record<string, BonusSpellGrant[]> {
  if (source.index !== "land" || source.class.index !== "druid" || source.spells.length !== 56) throw Error("Unsupported SRD Land spell grants");
  const tiers = new Map<string, Map<number, string[]>>();
  for (const grant of source.spells) {
    const terrain = grant.prerequisites.filter(value => value.type === "feature");
    const level = grant.prerequisites.filter(value => value.type === "level");
    const number = level[0]?.index.match(/^druid-([3579])$/)?.[1];
    if (grant.prerequisites.length !== 2 || terrain.length !== 1 || level.length !== 1 || !number
      || !LAND_TERRAINS.some(value => terrain[0].index === `circle-of-the-land-${value}`)
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(grant.spell.index)) throw Error("Unsupported SRD Land spell predicate");
    const rows = tiers.get(terrain[0].index) ?? new Map<number, string[]>();
    const spells = rows.get(Number(number)) ?? [];
    if (spells.includes(grant.spell.index)) throw Error("Duplicate SRD Land spell grant");
    spells.push(grant.spell.index); rows.set(Number(number), spells); tiers.set(terrain[0].index, rows);
  }
  return Object.fromEntries(LAND_TERRAINS.map(terrain => {
    const key = `circle-of-the-land-${terrain}`, rows = tiers.get(key);
    if (rows?.size !== 4 || [3, 5, 7, 9].some(level => rows.get(level)?.length !== 2)) throw Error("Incomplete SRD Land spell tiers");
    return [key, [...rows].sort(([a], [b]) => a - b).map(([class_level, spells]) => ({ class_level, spells, always_prepared: true }))];
  }));
}

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
export function transformFeatureEntry(feature: ApiFeature, landGrants?: readonly BonusSpellGrant[]): TransformedContent {
    const effects: Effect[] = [];
    if (feature.desc.length > 0) {
      effects.push(buildNarrativeEffect(feature.desc.join("\n"), "Class Feature"));
    }
    if (feature.index === "druidic") {
      // Genuine cached /api/2014/features/druidic: this earned feature owns the
      // language, including on an empty import before immutable publication.
      const description = ["You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages. You and others who know this language automatically spot such a message. Others spot the message's presence with a successful DC 15 Wisdom (Perception) check but can't decipher it without magic."];
      if (feature.name !== "Druidic" || feature.class.index !== "druid" || feature.subclass || feature.level !== 1
        || feature.prerequisites.length !== 0 || feature.feature_specific || JSON.stringify(feature.desc) !== JSON.stringify(description)) {
        throw Error("Unsupported SRD Druidic source");
      }
      effects.push(buildGrantEffect("language", "druidic"));
    }

    // Only the actual twelve subclass gates are subclass selectors. Names
    // such as "Domain Spells" or "Circle of the Land: Arctic" are not gates.
    const expertise = rogueExpertise(feature) ?? bardExpertise(feature);
    const terrain = rangerTerrain(feature);
    const favored_enemy = rangerEnemies(feature);
    const selection_prerequisites = invocationPrerequisites(feature);
    const bonus_spells = bonusSpells(feature);
    const lore = loreSkills(feature);
    if (landGrants && (feature.class.index !== "druid" || feature.subclass?.index !== "land" || feature.level !== 2
      || !LAND_TERRAINS.some(terrain => feature.index === `circle-of-the-land-${terrain}`))) throw Error("Unsupported SRD Land spell controller");
    let feature_type = "passive";
    if (lore) {
      feature_type = "choice";
      effects.push(buildChoiceEffect(3, lore, "proficiency", feature.index));
    } else if (expertise) {
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
      ...(bonus_spells ? { bonus_spells } : {}),
      ...(landGrants ? { bonus_spell_grants: landGrants } : {}),
      ...(choices ? { choices: [{ name: feature.name, count: choices.choose,
        options: referenceOptions(choices).map(option => option.index) }] } : invocations
        ? { choices: [{ name: feature.name, count: 2, options: invocations.map(option => option.index) }] } : {}),
    }, effects);
}

export async function transformFeatures(): Promise<TransformedContent[]> {
  const features = await fetchAllFromApi<ApiFeature>("/features");
  const landGrants = transformLandSpellGrants(await fetchFromApi<ApiLandSpellSource>("/subclasses/land"));
  return features.map(feature => transformFeatureEntry(feature, landGrants[feature.index]));
}
