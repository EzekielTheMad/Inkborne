import type { EffectiveCastingSource } from "./effective-sources";

/** Eligibility for the existing class selection budget. Expanded subclass
 * lists do not alter known counts, grant spells, or increase slot levels. */
export function isOrdinaryClassSpellEligible(
  source: EffectiveCastingSource,
  spell: { slug?: unknown; system_id?: unknown; source?: unknown; scope?: unknown; owner_id?: unknown; data: Record<string, unknown> },
): boolean {
  const level = spell.data.level;
  const min = source.spellList.level[0], max = Math.min(source.maxLearnableLevel, source.spellList.level[1]);
  if (!source.active || source.config === null || typeof level !== "number" || !Number.isInteger(level)
    || !Number.isInteger(min) || min < 0 || !Number.isInteger(max) || max > 9
    || level < min || level > max || !Array.isArray(spell.data.classes)
    || spell.data.classes.length === 0 || !spell.data.classes.every(value => typeof value === "string" && value.trim().length > 0)) return false;
  if (spell.data.classes.includes(source.spellList.class)) return true;
  const origin = source.expandedSpellSource;
  return !!origin && typeof spell.slug === "string" && (source.expandedSpellSlugs ?? []).includes(spell.slug)
    && spell.system_id === origin.system_id && spell.source === origin.source && spell.scope === origin.scope
    && spell.owner_id === origin.owner_id;
}
