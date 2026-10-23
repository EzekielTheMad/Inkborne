import { fetchFromApi, fetchAllFromApi, buildContentEntry, buildChoiceEffect, buildGrantEffect, expandAbilityAbbreviation, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect, StatCondition } from "@/lib/types/effects";
import { referenceOptions, startingEquipmentText, type ApiChoice, type ApiReference } from "./api-options";

export const SUBCLASS_LEVELS: Readonly<Record<string, number>> = {
  barbarian: 3, bard: 3, cleric: 1, druid: 2, fighter: 3, monk: 3,
  paladin: 3, ranger: 3, rogue: 3, sorcerer: 1, warlock: 1, wizard: 2,
};

interface ApiClass {
  index: string;
  name: string;
  hit_die: number;
  proficiency_choices: ApiChoice[];
  proficiencies: Array<{ index: string; name: string }>;
  saving_throws: Array<{ index: string; name: string }>;
  starting_equipment: Array<{ equipment: ApiReference; quantity: number }>;
  starting_equipment_options: ApiChoice[];
  subclasses: Array<{ index: string; name: string }>;
  spellcasting?: {
    level: number;
    spellcasting_ability: { index: string; name: string };
    info: Array<{ name: string; desc: string[] }>;
  };
  multi_classing: {
    prerequisites?: Array<{ ability_score: { index: string; name: string }; minimum_score: number }>;
    proficiencies: Array<{ index: string; name: string }>;
  };
}

interface ApiClassLevel {
  level: number;
  ability_score_bonuses: number;
  prof_bonus: number;
  features: Array<{ index: string; name: string }>;
  spellcasting?: {
    cantrips_known?: number;
    spell_slots_level_1?: number;
    spell_slots_level_2?: number;
    spell_slots_level_3?: number;
    spell_slots_level_4?: number;
    spell_slots_level_5?: number;
    spell_slots_level_6?: number;
    spell_slots_level_7?: number;
    spell_slots_level_8?: number;
    spell_slots_level_9?: number;
  };
  class_specific: Record<string, unknown>;
  subclass?: { index: string };
}

interface ApiSubclass {
  index: string;
  name: string;
  class: { index: string; name: string };
  subclass_flavor: string;
  desc: string[];
  subclass_levels: string;
  spells?: Array<{ spell: { index: string; name: string }; prerequisites?: Array<{ type: string; index: string }> }>;
}

interface ApiSubclassChoiceController {
  index: string;
  class: { index: string };
  subclass?: { index: string };
  level: number;
  feature_specific?: { subfeature_options?: ApiChoice };
}

/** The API's Land level listing omits its terrain controller even though the
 * genuine feature resource owns the seven options and explicitly earns them
 * at Druid/Land level two. Restore that source relationship before publishing
 * the immutable subclass manifest; never infer it from a saved user choice.
 */
export function subclassFeatureManifest(subclass: Pick<ApiSubclass, "index" | "class">,
  sourceLevels: readonly { level: number; features: readonly { index: string }[] }[], controller?: ApiSubclassChoiceController) {
  const levels = sourceLevels.map(row => ({ level: row.level, features: row.features.map(feature => feature.index) }));
  if (subclass.index !== "land") return levels;
  const options = controller?.feature_specific?.subfeature_options;
  const terrains = ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp"]
    .map(terrain => `circle-of-the-land-${terrain}`);
  if (subclass.class.index !== "druid" || controller?.index !== "circle-of-the-land" || controller.class.index !== "druid"
    || controller.subclass?.index !== "land" || controller.level !== 2 || options?.choose !== 1
    || options.from.options?.length !== terrains.length
    || !options.from.options.every(option => option.option_type === "reference" && option.item && terrains.includes(option.item.index))
    || new Set(options.from.options.map(option => option.item!.index)).size !== terrains.length
    || levels.filter(row => row.level === 2).length !== 1) {
    throw Error("The genuine SRD Circle of the Land controller is unavailable or changed");
  }
  const existing = levels.flatMap(row => row.features.filter(slug => slug === controller.index).map(() => row.level));
  if (existing.length > 1 || existing.some(level => level !== controller.level)) {
    throw Error("The SRD Circle of the Land controller has conflicting level ownership");
  }
  if (!existing.length) levels.find(row => row.level === controller.level)!.features.push(controller.index);
  return levels;
}

/** The SRD Fiend expands the Warlock list for ordinary learned choices. Life
 * domain spells remain always-prepared grants; Land's conditional terrain
 * spells remain owned by their selected terrain features. */
export function subclassSpellMetadata(subclass: Pick<ApiSubclass, "index" | "class" | "spells">) {
  const spellTiers = new Map<number, string[]>();
  for (const grant of subclass.spells ?? []) {
    // Conditional source edges must not become unconditional subclass grants.
    if (grant.prerequisites?.some(prerequisite => prerequisite.type !== "level")) {
      if (subclass.index === "fiend") throw new Error("The genuine SRD Fiend expanded spell list is unavailable or changed");
      continue;
    }
    const level = grant.prerequisites?.find(prerequisite => prerequisite.type === "level")?.index.match(/-(\d+)$/)?.[1];
    if (!level) throw new Error(`Missing SRD subclass spell level: ${subclass.index}/${grant.spell.index}`);
    if (subclass.index === "fiend" && (grant.prerequisites?.length !== 1
      || grant.prerequisites[0].index !== `warlock-${level}`)) {
      throw new Error("The genuine SRD Fiend expanded spell list is unavailable or changed");
    }
    const tier = spellTiers.get(Number(level)) ?? [];
    tier.push(grant.spell.index); spellTiers.set(Number(level), tier);
  }
  const tiers = [...spellTiers].sort(([a], [b]) => a - b).map(([level, spells]) => ({ level, spells }));
  if (subclass.index === "fiend") {
    // Reviewed against the genuine 2014 API edges and SRD 5.1 Fiend table.
    const expected = [
      { level: 1, spells: ["burning-hands", "command"] },
      { level: 3, spells: ["blindness-deafness", "scorching-ray"] },
      { level: 5, spells: ["fireball", "stinking-cloud"] },
      { level: 7, spells: ["fire-shield", "wall-of-fire"] },
      { level: 9, spells: ["flame-strike", "hallow"] },
    ];
    const canonical = (entries: typeof tiers) => entries.map(tier => ({ ...tier, spells: [...tier.spells].sort() }));
    if (subclass.class.index !== "warlock" || JSON.stringify(canonical(tiers)) !== JSON.stringify(canonical(expected))) {
      throw new Error("The genuine SRD Fiend expanded spell list is unavailable or changed");
    }
    return { spellcastingExpanded: tiers };
  }
  return tiers.length ? { spellcastingExtra: tiers } : {};
}

function mapSpellcastingType(className: string): "full" | "half" | "third" | "pact" | null {
  const fullCasters = ["wizard", "sorcerer", "cleric", "druid", "bard"];
  const halfCasters = ["paladin", "ranger"];
  const thirdCasters = ["eldritch-knight", "arcane-trickster"];
  if (fullCasters.includes(className)) return "full";
  if (halfCasters.includes(className)) return "half";
  if (thirdCasters.includes(className)) return "third";
  if (className === "warlock") return "pact";
  return null;
}

export function transformClassEntry(apiClass: ApiClass, apiLevels: ApiClassLevel[]): TransformedContent {
  const effects: Effect[] = [];

  // Phase 3: derive skillstxt from proficiency choices
  const skillChoices = apiClass.proficiency_choices
    .filter((c) => referenceOptions(c).some((o) => o.index.startsWith("skill-")));
  const skillstxt = skillChoices.length > 0
    ? `Choose ${skillChoices[0].choose} from ${
        referenceOptions(skillChoices[0])
          .filter((o) => o.index.startsWith("skill-"))
          .map((o) => o.name.replace("Skill: ", ""))
          .join(", ")
      }`
    : undefined;

  // Proficiency choices (e.g., choose 2 skills)
  for (let i = 0; i < apiClass.proficiency_choices.length; i++) {
    const choice = apiClass.proficiency_choices[i];
    const options = referenceOptions(choice).map((o) => normalizeSlug(o.index));
    effects.push(buildChoiceEffect(
      choice.choose,
      options,
      "proficiency",
      `${apiClass.index}-proficiency-choice-${i}`
    ));
  }

  // Saving throw proficiencies
  for (const save of apiClass.saving_throws) {
    effects.push(buildGrantEffect(`save_${expandAbilityAbbreviation(save.index)}`, "proficient"));
  }

  // Multiclass prerequisites
  const prerequisites: StatCondition[] = (apiClass.multi_classing.prerequisites ?? []).map((p) => ({
    stat: expandAbilityAbbreviation(p.ability_score.index),
    op: "gte" as const,
    value: p.minimum_score,
  }));

  // Spellcasting config
  const spellcasting = apiClass.spellcasting
    ? {
        ability: expandAbilityAbbreviation(apiClass.spellcasting.spellcasting_ability.index),
        type: mapSpellcastingType(apiClass.index) ?? "full",
        focus: ({ bard: "musical instrument", cleric: "holy symbol", druid: "druidic focus", sorcerer: "arcane focus", warlock: "arcane focus", wizard: "arcane focus" } as Record<string, string>)[apiClass.index] ?? "",
        ritual_casting: ["wizard", "cleric", "druid", "bard"].includes(apiClass.index),
      }
    : null;

  // Level progression
  const sortedLevels = [...apiLevels].sort((a, b) => a.level - b.level);
  const levels = sortedLevels.map((lvl) => {
    const spellSlots = lvl.spellcasting
      ? [
          lvl.spellcasting.spell_slots_level_1 ?? 0,
          lvl.spellcasting.spell_slots_level_2 ?? 0,
          lvl.spellcasting.spell_slots_level_3 ?? 0,
          lvl.spellcasting.spell_slots_level_4 ?? 0,
          lvl.spellcasting.spell_slots_level_5 ?? 0,
          lvl.spellcasting.spell_slots_level_6 ?? 0,
          lvl.spellcasting.spell_slots_level_7 ?? 0,
          lvl.spellcasting.spell_slots_level_8 ?? 0,
          lvl.spellcasting.spell_slots_level_9 ?? 0,
        ]
      : null;

    return {
      level: lvl.level,
      features: lvl.features.map((f) => f.index),
      spellcasting: spellSlots
        ? { cantrips_known: lvl.spellcasting?.cantrips_known, spell_slots: spellSlots }
        : null,
      ...(lvl.subclass || SUBCLASS_LEVELS[apiClass.index] === lvl.level ? { subclass_level: true } : {}),
      ...(Object.keys(lvl.class_specific).length > 0 ? { class_specific: lvl.class_specific } : {}),
    };
  });

  // Derive improvements (ASI levels) from API level feature data
  // TODO: attacks array is MPMB-seeded via SQL migration 00013_mpmb_class_enrichment.sql
  const improvements = sortedLevels.map((lvl) =>
    lvl.features.some((f) => f.index.includes("ability-score-improvement"))
  );

  // Derive cantrips known array from API level data (one entry per level, 20 total)
  // spellcastingKnown.spells, spellcastingKnown.prepared, and spellcastingExtra are
  // MPMB-seeded via SQL migration 00014_mpmb_spellcasting_known.sql
  const cantripsKnown = sortedLevels
    .map((lvl) => lvl.spellcasting?.cantrips_known ?? 0);
  const hasCantrips = cantripsKnown.some((c) => c > 0);

  // Data-only reviewed SRD constants add display/proficiency/progression detail
  // in buildContentEntry, before the complete import is validated and promoted.
  return buildContentEntry("class", apiClass.index, apiClass.name, {
    hit_die: apiClass.hit_die,
    spellcasting,
    multiclass: {
      prerequisites,
      proficiencies_gained: apiClass.multi_classing.proficiencies.map((p) => p.index),
    },
    saving_throws: apiClass.saving_throws.map((s) => expandAbilityAbbreviation(s.index)),
    starting_proficiencies: apiClass.proficiencies.map((p) => p.index),
    levels,
    ...(improvements.some(Boolean) ? { improvements } : {}),
    // API cantrips plus reviewed spells-known/prepared progression enrichment.
    ...(hasCantrips ? {
      spellcastingKnown: {
        cantrips: cantripsKnown,
      },
    } : {}),
    // spellcastingList derived from class slug; half-casters cap at spell level 5
    ...(spellcasting ? {
      spellcastingList: {
        class: apiClass.index,
        level: [0, mapSpellcastingType(apiClass.index) === "half" ? 5 : 9] as [number, number],
      },
    } : {}),
    // Phase 3 fields from API
    ...(skillstxt ? { skillstxt } : {}),
    equipment: startingEquipmentText(apiClass.starting_equipment, apiClass.starting_equipment_options),
    source_refs: [{ book: "SRD", page: 0 }],
  }, effects);
}

export async function transformClasses(): Promise<TransformedContent[]> {
  const classes = await fetchAllFromApi<ApiClass>("/classes");
  const results: TransformedContent[] = [];

  for (const cls of classes) {
    const levels = await fetchFromApi<ApiClassLevel[]>(`/classes/${cls.index}/levels`);
    results.push(transformClassEntry(cls, levels));
  }

  // Subclasses
  const subclasses = await fetchAllFromApi<ApiSubclass>("/subclasses");
  for (const sub of subclasses) {
    const subLevels = await fetchFromApi<ApiClassLevel[]>(`/subclasses/${sub.index}/levels`);
    const landController = sub.index === "land"
      ? await fetchFromApi<ApiSubclassChoiceController>("/features/circle-of-the-land") : undefined;
    const levels = subclassFeatureManifest(sub, subLevels, landController);

    results.push(buildContentEntry("subclass", sub.index, sub.name, {
      parent_class: sub.class.index,
      flavor_label: sub.subclass_flavor,
      description: sub.desc.join("\n"),
      levels,
      spells: [],
      ...subclassSpellMetadata(sub),
    }));
  }

  return results;
}
