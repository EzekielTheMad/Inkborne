import { z } from "zod";
import { getContentTypeSchema } from "@/lib/schemas/content-types";
import { effectSchema } from "@/lib/schemas/effects";
import type { TransformedContent } from "./common";

const identity = z.object({ content_type: z.string().min(1), slug: z.string().min(1), name: z.string().min(1) });
const effects = z.array(effectSchema);

/** Normalize with the same schemas as catalog and immutable-pin readers before
 * the first publication write. Refuse incomplete dependency graphs as a whole.
 */
export function validateSrdCatalog(entries: readonly TransformedContent[]): TransformedContent[] {
  const normalized = entries.map(entry => {
    identity.parse(entry);
    const schema = getContentTypeSchema(entry.content_type);
    if (!schema) throw new Error(`Unknown SRD content type: ${entry.content_type}`);
    const data = schema.safeParse(entry.data), parsedEffects = effects.safeParse(entry.effects);
    if (!data.success || !parsedEffects.success) {
      const issues = [...(data.success ? [] : data.error.issues), ...(parsedEffects.success ? [] : parsedEffects.error.issues)];
      throw new Error(`Invalid SRD ${entry.content_type}/${entry.slug}: ${issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    }
    return { ...entry, data: data.data as Record<string, unknown>, effects: parsedEffects.data };
  });
  const identities = new Set(normalized.map(entry => `${entry.content_type}/${entry.slug}`));
  const check = (source: TransformedContent, type: string, slug: unknown) => {
    if (typeof slug !== "string" || !identities.has(`${type}/${slug}`)) throw new Error(`Missing SRD dependency: ${source.content_type}/${source.slug} -> ${type}/${String(slug)}`);
  };
  const list = (value: unknown): string[] => Array.isArray(value) ? value as string[] : [];
  for (const entry of normalized) {
    const data = entry.data;
    if (["race", "subrace"].includes(entry.content_type)) for (const slug of list(data.traits)) check(entry, "trait", slug);
    if (entry.content_type === "race" && data.earned_racial_spells) {
      if (entry.slug !== "tiefling") throw Error("Earned racial spells require the reviewed Tiefling root");
      const policy = data.earned_racial_spells as { source_trait: string; grants: Array<{ spell: string }> };
      check(entry, "trait", policy.source_trait);
      for (const grant of policy.grants) check(entry, "spell", grant.spell);
      if (list(data.traits).filter(slug => slug === policy.source_trait).length !== 1) throw Error("Earned racial spells require their unique mandatory trait");
    }
    if (entry.content_type === "race") for (const slug of list(data.subraces)) check(entry, "subrace", slug);
    if (entry.content_type === "subrace") check(entry, "race", data.parent_race);
    if (["class", "subclass"].includes(entry.content_type)) {
      for (const level of data.levels as Array<{ features: string[] }>) for (const slug of level.features) check(entry, "feature", slug);
    }
    if (entry.content_type === "subclass") {
      check(entry, "class", data.parent_class);
      for (const slug of list(data.spells)) check(entry, "spell", slug);
      for (const tier of (data.spellcastingExtra as Array<string | string[] | { spells: string[] }> | undefined) ?? []) {
        for (const slug of typeof tier === "string" ? [tier] : Array.isArray(tier) ? tier : tier.spells) check(entry, "spell", slug);
      }
      for (const tier of (data.spellcastingExpanded as Array<{ spells: string[] }> | undefined) ?? []) {
        for (const slug of tier.spells) check(entry, "spell", slug);
      }
    }
    if (entry.content_type === "feature") {
      check(entry, "class", data.class);
      if (data.subclass) check(entry, "subclass", data.subclass);
      for (const choice of (data.choices as Array<{ options: string[] }> | undefined) ?? []) for (const slug of choice.options) check(entry, "feature", slug);
      for (const prerequisite of (data.selection_prerequisites as Array<{ kind: string; slug?: string }> | undefined) ?? []) {
        if (["feature", "spell"].includes(prerequisite.kind)) check(entry, prerequisite.kind, prerequisite.slug);
      }
      for (const grant of (data.bonus_spell_grants as Array<{ spells: string[] }> | undefined) ?? []) {
        for (const slug of grant.spells) check(entry, "spell", slug);
      }
    }
    if (entry.content_type === "trait") {
      for (const slug of list(data.races)) check(entry, "race", slug);
      for (const slug of list(data.subraces)) check(entry, "subrace", slug);
    }
    for (const effect of entry.effects) {
      if (effect.type === "grant" && effect.stat === "spell") check(entry, "spell", effect.value);
      if (effect.type !== "choice" || !Array.isArray(effect.from)) continue;
      const type = ({ proficiency: "proficiency", expertise: "proficiency", language: "language", spell: "spell", trait: "trait",
        feature: "feature", invocation: "feature" } as Record<string, string>)[effect.grant_type];
      if (type) for (const slug of effect.from) check(entry, type, slug);
    }
  }
  return normalized;
}
