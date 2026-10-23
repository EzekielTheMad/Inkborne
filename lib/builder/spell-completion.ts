import type { CharacterSpell } from "@/lib/types/spells";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";
import { isOrdinaryClassSpellEligible } from "@/lib/spells/spell-eligibility";
import { computeMaxPrepared } from "@/lib/spells/helpers";
import { readBonusSpellChoices, isBonusSpellEligible, ordinaryKnownSpellBudget, type BonusSpellPin } from "./bonus-spells";
import type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";

export type BuilderSpellCompletionRow = Pick<CharacterSpell,
  "content_id" | "content_version" | "class_slug" | "source" | "is_prepared" | "is_known" | "in_spellbook" | "always_prepared"
> & { custom_data?: Record<string, unknown> | null; content_definitions?: Pick<ParsedContentDefinition, "id" | "version" | "content_type" | "data"> & Partial<Pick<ParsedContentDefinition, "slug">> | null };

export interface BonusSpellCompletionEvidence {
  features: ReadonlyArray<Pick<ParsedContentDefinition, "id" | "version" | "slug" | "data"> & { ref_id: string }>;
  selections: Record<string, BonusSpellPin[]>;
}

/** Only physical selections and their exact immutable snapshots establish completion. */
export function classSpellSelectionsComplete(
  sources: EffectiveCastingSource[],
  rows: BuilderSpellCompletionRow[],
  abilityScores: Record<string, number>,
  bonus?: BonusSpellCompletionEvidence,
): boolean {
  if (new Set(sources.map(source => source.classSlug)).size !== sources.length) return false;
  const active = sources.filter(source => source.active && source.config !== null);
  const bonusGroups = (bonus?.features ?? []).flatMap(feature => {
    const source = active.find(candidate => candidate.classSlug === feature.data.class);
    if (!source || typeof feature.data.level !== "number" || feature.data.level > source.classLevel
      || typeof feature.data.subclass === "string" && feature.data.subclass !== source.subclassSlug) return [];
    return readBonusSpellChoices(feature.data).map(choice => ({ feature, choice, source }));
  });
  if (new Set(bonusGroups.map(group => group.choice.choice_id)).size !== bonusGroups.length) return false;
  if (Object.keys(bonus?.selections ?? {}).some(id => !bonusGroups.some(group => group.choice.choice_id === id))) return false;
  const signatureIds = new Set(bonusGroups.filter(group => group.choice.mode === "signature")
    .flatMap(group => bonus?.selections[group.choice.choice_id] ?? []).map(pin => `${pin.content_id}:${pin.content_version}`));
  const selections = rows.filter(row => row.source === "selection");
  if (selections.some(row => !active.some(source => source.classSlug === row.class_slug))) return false;
  for (const source of active) {
    const selected = selections.filter(row => row.class_slug === source.classSlug);
    const maxLevel = Math.min(source.maxLearnableLevel, source.spellList.level[1]);
    if (!Number.isInteger(source.cantripsKnown) || source.cantripsKnown < 0 || !Number.isInteger(source.classLevel)
      || source.classLevel < 1 || source.classLevel > 20 || !Number.isInteger(maxLevel)
      || !Number.isInteger(source.spellList.level[0]) || source.spellList.level[0] < 0
      || maxLevel < source.spellList.level[0] || maxLevel > 9 || selected.length > 200
      || new Set(selected.map(row => row.content_id)).size !== selected.length) return false;
    const cantrips: BuilderSpellCompletionRow[] = [], levelled: BuilderSpellCompletionRow[] = [];
    for (const row of selected) {
      const definition = row.content_definitions;
      const level = definition?.data.level;
      if (!row.content_id || !Number.isInteger(row.content_version) || row.content_version! < 1 || row.always_prepared && !(source.classSlug === "wizard" && signatureIds.has(`${row.content_id}:${row.content_version}`)) || !row.is_known
        || !definition || definition.id !== row.content_id || definition.version !== row.content_version
        || definition.content_type !== "spell" || typeof level !== "number" || !Number.isInteger(level)
        || !isOrdinaryClassSpellEligible(source, definition)) return false;
      (level === 0 ? cantrips : levelled).push(row);
    }
    if (cantrips.length !== source.cantripsKnown || cantrips.some(row => row.in_spellbook)) return false;
    const wizard = source.kind === "class" && source.classSlug === "wizard";
    if (wizard && (levelled.length !== 6 + 2 * (source.classLevel - 1) || levelled.some(row => !row.in_spellbook))) return false;
    if (!wizard && levelled.some(row => row.in_spellbook)) return false;
    if (source.prepared) {
      const score = source.config ? abilityScores[source.config.ability] : undefined;
      if (typeof score !== "number" || !Number.isFinite(score)) return false;
      const modifier = Math.floor((score - 10) / 2);
      const allowance = source.preparationRule === "parent"
        ? computeMaxPrepared(source.classSlug, source.classLevel, modifier)
        : Math.max(1, modifier + (source.preparationRule === "half-class-level-plus-ability" ? Math.floor(source.classLevel / 2) : source.classLevel));
      const count = levelled.filter(row => row.is_prepared && !row.always_prepared).length;
      if (count < 1 && !levelled.some(row => row.always_prepared && row.is_prepared) || count > allowance) return false;
    } else {
      const knownBudget = source.spellsKnown === "all" ? "all" : ordinaryKnownSpellBudget(source.spellsKnown,
        bonusGroups.filter(group => group.source.classSlug === source.classSlug).map(group => group.choice));
      if (knownBudget !== "all" && (!Number.isInteger(knownBudget) || knownBudget < 0 || levelled.length !== knownBudget)) return false;
      if (levelled.some(row => !row.is_known || row.is_prepared || row.in_spellbook)) return false;
    }
  }
  for (const { feature, choice, source } of bonusGroups) {
    const picked = bonus?.selections[choice.choice_id];
    if (!Array.isArray(picked) || picked.length !== choice.choose || new Set(picked.map(pin => pin.content_id)).size !== picked.length) return false;
    const spellbook = selections.filter(row => row.class_slug === source.classSlug && row.in_spellbook && row.content_id && row.content_version)
      .map(row => ({ content_id: row.content_id!, content_version: row.content_version! }));
    for (const pin of picked) {
      const matching = rows.filter(row => row.class_slug === source.classSlug && row.content_id === pin.content_id && row.content_version === pin.content_version
        && (choice.spellbook_only ? row.source === "selection" && row.in_spellbook : row.source === "bonus"
          && row.custom_data?.builder_bonus_choice_id === choice.choice_id && row.custom_data?.builder_bonus_source_ref_id === feature.ref_id));
      const row = matching[0], definition = row?.content_definitions;
      if (matching.length !== 1 || !definition || !isBonusSpellEligible(choice, definition, { classMaxSpellLevel: source.maxLearnableLevel, spellbook })
        || choice.always_prepared && (!row.always_prepared || !row.is_prepared)) return false;
    }
  }
  return !sources.some(source => source.active && source.config === null);
}
