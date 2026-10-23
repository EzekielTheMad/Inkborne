import overlays from "./srd-enrichment-data.json";
import type { TransformedContent } from "./common";
import type { Effect } from "@/lib/types/effects";

/** Data-only constants reviewed from migrations 00011–00018, 00020 and 00030.
 * Applied before validation/promotion so an empty baseline and a reimport agree.
 * No import-time SQL execution, post-publication UPDATE or fabricated versions.
 * Ability bonuses remain API effects; class equipment comes from API option
 * trees. Acolyte prose restores items omitted by the API equipment array.
 */
export function enrichSrdEntry(entry: TransformedContent): TransformedContent {
  const overlay = (overlays as Record<string, Record<string, unknown>>)[`${entry.content_type}/${entry.slug}`];
  const data = { source_refs: [{ book: "SRD", page: 0 }], ...entry.data, ...structuredClone(overlay ?? {}) };
  const effects = [...entry.effects];
  const extra: Effect[] = [];
  if (entry.content_type === "feature" && /(?:^|-)fighting-style-defense$/.test(entry.slug)) {
    extra.push({ type: "mechanical", stat: "armor_class", op: "add", value: 1,
      condition: { field: "equipped_armor", op: "neq", value: "none" } });
  }
  if (entry.content_type === "feature" && entry.slug === "barbarian-unarmored-defense") {
    extra.push({ type: "mechanical", stat: "armor_class", op: "formula", expr: "10 + mod(dexterity) + mod(constitution)", tag: "ac_formula",
      condition: { field: "equipped_armor", op: "eq", value: "none" } });
  }
  if (entry.content_type === "feature" && entry.slug === "monk-unarmored-defense") {
    extra.push({ type: "mechanical", stat: "armor_class", op: "formula", expr: "10 + mod(dexterity) + mod(wisdom)", tag: "ac_formula",
      condition: [{ field: "equipped_armor", op: "eq", value: "none" }, { field: "shield_equipped", op: "eq", value: false }] });
  }
  if (entry.content_type === "trait" && entry.slug === "infernal-legacy") {
    extra.push({ type: "grant", stat: "spell", value: "thaumaturgy" },
      { type: "grant", stat: "spellcasting_ability", value: "charisma" });
  }
  if (entry.content_type === "feature" && entry.slug === "eldritch-invocation-beguiling-influence") {
    extra.push({ type: "grant", stat: "skill-deception", value: "proficient" },
      { type: "grant", stat: "skill-persuasion", value: "proficient" });
  }
  if (entry.content_type === "feature" && entry.slug === "dragon-ancestor") {
    extra.push({ type: "grant", stat: "language", value: "draconic" });
  }
  return { ...entry, data, effects: [...effects, ...extra] };
}
