import { fetchFromApi, fetchAllFromApi, buildContentEntry, buildChoiceEffect, buildGrantEffect, expandAbilityAbbreviation, normalizeSlug } from "./common";
import type { TransformedContent } from "./common";
import type { Effect, StatCondition } from "@/lib/types/effects";

interface ApiClass {
  index: string;
  name: string;
  hit_die: number;
  proficiency_choices: Array<{
    choose: number;
    from: { options: Array<{ item: { index: string; name: string } }> };
  }>;
  proficiencies: Array<{ index: string; name: string }>;
  saving_throws: Array<{ index: string; name: string }>;
  starting_equipment: Array<unknown>;
  starting_equipment_options: Array<unknown>;
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
  spells?: Array<{ spell: { index: string; name: string } }>;
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

  // Proficiency choices (e.g., choose 2 skills)
  for (let i = 0; i < apiClass.proficiency_choices.length; i++) {
    const choice = apiClass.proficiency_choices[i];
    const options = choice.from.options.filter((o) => o.item != null).map((o) => normalizeSlug(o.item.index));
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
        focus: "",
        ritual_casting: false,
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
      ...(lvl.subclass ? { subclass_level: true } : {}),
      ...(Object.keys(lvl.class_specific).length > 0 ? { class_specific: lvl.class_specific } : {}),
    };
  });

  // Derive improvements (ASI levels) from API level feature data
  // TODO: attacks array is MPMB-seeded via SQL migration 00013_mpmb_class_enrichment.sql
  const improvements = sortedLevels.map((lvl) =>
    lvl.features.some((f) => f.index.includes("ability-score-improvement"))
  );

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
    const levels = subLevels.map((lvl) => ({
      level: lvl.level,
      features: lvl.features.map((f) => f.index),
    }));

    results.push(buildContentEntry("subclass", sub.index, sub.name, {
      parent_class: sub.class.index,
      flavor_label: sub.subclass_flavor,
      description: sub.desc.join("\n"),
      levels,
      spells: (sub.spells ?? []).map((s) => s.spell.index),
    }));
  }

  return results;
}
