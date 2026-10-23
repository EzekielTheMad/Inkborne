import type { CharacterSpell } from "@/lib/types/spells";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";
import { computeMaxPrepared } from "@/lib/spells/helpers";
import type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";

export type BuilderSpellCompletionRow = Pick<CharacterSpell,
  "content_id" | "content_version" | "class_slug" | "source" | "is_prepared" | "is_known" | "in_spellbook" | "always_prepared"
> & { content_definitions?: Pick<ParsedContentDefinition, "id" | "version" | "content_type" | "data"> | null };

/** Only physical selections and their exact immutable snapshots establish completion. */
export function classSpellSelectionsComplete(
  sources: EffectiveCastingSource[],
  rows: BuilderSpellCompletionRow[],
  abilityScores: Record<string, number>,
): boolean {
  if (new Set(sources.map(source => source.classSlug)).size !== sources.length) return false;
  const active = sources.filter(source => source.active && source.config !== null);
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
      if (!row.content_id || !Number.isInteger(row.content_version) || row.content_version! < 1 || row.always_prepared || !row.is_known
        || !definition || definition.id !== row.content_id || definition.version !== row.content_version
        || definition.content_type !== "spell" || typeof level !== "number" || !Number.isInteger(level)
        || level < source.spellList.level[0] || level > maxLevel || !Array.isArray(definition.data.classes)
        || !definition.data.classes.includes(source.spellList.class)) return false;
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
      const count = levelled.filter(row => row.is_prepared).length;
      if (count < 1 || count > allowance) return false;
    } else {
      if (source.spellsKnown !== "all" && (!Number.isInteger(source.spellsKnown) || source.spellsKnown < 0 || levelled.length !== source.spellsKnown)) return false;
      if (levelled.some(row => !row.is_known || row.is_prepared || row.in_spellbook)) return false;
    }
  }
  return !sources.some(source => source.active && source.config === null);
}
