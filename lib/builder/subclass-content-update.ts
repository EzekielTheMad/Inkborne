import { z } from "zod";
import { boundedClassRoleJson, classRoleRevisionSchema } from "@/lib/character/class-role-effects-schema";
import { subclassSpellcastingExpandedSchema } from "@/lib/schemas/content-types/subclass";
import { equalEquipmentIntent } from "./starting-equipment-contract";

const version = z.number().int().min(1).max(2147483647);
export const subclassContentUpdateFieldsSchema = z.strictObject({
  class_slug: z.literal("warlock"), occurrence_id: z.uuid(), subclass_ref_id: z.uuid(), content_id: z.uuid(),
  expected_content_version: version, target_content_version: version,
  expected_action_revision: classRoleRevisionSchema, preview_digest: z.string().regex(/^[a-f0-9]{64}$/),
}).refine(value => value.target_content_version > value.expected_content_version, "A newer subclass version is required");
export type SubclassContentUpdateFields = z.infer<typeof subclassContentUpdateFieldsSchema>;

const consequence = z.strictObject({
  kind: z.enum(["feature", "spell_grant", "ordinary_spell", "choice", "expanded_spell", "invariant"]),
  label: z.string().min(1).max(500).refine(value => value.trim() === value),
});
export const subclassContentUpdatePreviewSchema = z.strictObject({
  contract_version: z.literal(1), character_id: z.uuid(), actor_id: z.uuid(),
  fields: subclassContentUpdateFieldsSchema,
  saved_name: z.string().min(1).max(200), target_name: z.string().min(1).max(200),
  retained: z.array(consequence).max(1024), removed: z.array(consequence).max(1024), added: z.array(consequence).max(1024),
  automatic_spells_learned: z.literal(0),
});
export type SubclassContentUpdatePreview = z.infer<typeof subclassContentUpdatePreviewSchema>;
export const subclassContentUpdateResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("available"), preview: subclassContentUpdatePreviewSchema }),
  z.strictObject({ status: z.literal("unavailable"), reason: z.enum(["no_update", "unsupported", "conflict", "unavailable"]) }),
]);
export type SubclassContentUpdateResponse = z.infer<typeof subclassContentUpdateResponseSchema>;
export const subclassContentUpdateRequestSchema = z.strictObject({ subclass_ref_id: z.uuid(), target_content_version: version });
export type SubclassContentUpdateRequest = z.infer<typeof subclassContentUpdateRequestSchema>;
export type PreviewSubclassContentUpdate = (input: SubclassContentUpdateRequest) => Promise<unknown>;

export function parseSubclassContentUpdateResponse(value: unknown): SubclassContentUpdateResponse | null {
  try {
    if (!boundedClassRoleJson(value)) return null;
    const parsed = subclassContentUpdateResponseSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

interface SubclassDefinition {
  id: string; system_id?: string; content_type: string; slug: string; name: string; version: number;
  source: string; scope?: string; owner_id?: string | null; data: Record<string, unknown>; effects: unknown[];
}
interface SavedSubclassRef {
  id: string; character_id?: string; content_id: string; content_version?: number;
  context: Record<string, unknown>; content_definitions: SubclassDefinition;
}
export type FiendContentUpdateCandidate = Readonly<{
  occurrence_id: string; subclass_ref_id: string; content_id: string;
  expected_content_version: number; target_content_version: number; saved_name: string; target_name: string;
}>;

/** Display discovery only. Native preview validates raw snapshots and every
 * dependency in the complete source closure before offering confirmation. */
export function findFiendContentUpdate(characterId: string,
  classes: Array<{ slug: string; subclass?: string; occurrence_id?: string }>,
  refs: SavedSubclassRef[], catalog: SubclassDefinition[]): FiendContentUpdateCandidate | null {
  const selected = classes.filter(value => value.slug === "warlock");
  if (selected.length !== 1 || selected[0].subclass !== "fiend" || !z.uuid().safeParse(selected[0].occurrence_id).success) return null;
  const matches = refs.filter(ref => ref.content_definitions.content_type === "subclass"
    && ref.content_definitions.slug === "fiend");
  if (matches.length !== 1) return null;
  const ref = matches[0], saved = ref.content_definitions;
  if (!z.uuid().safeParse(ref.id).success || ref.character_id !== characterId || ref.content_id !== saved.id
    || ref.content_version !== saved.version || ref.context.source !== "subclass" || ref.context.class !== "warlock"
    || !z.uuid().safeParse(saved.id).success || !z.uuid().safeParse(saved.system_id).success
    || saved.source !== "srd" || saved.scope !== "platform" || saved.owner_id !== null
    || saved.data.parent_class !== "warlock" || !version.safeParse(saved.version).success
    || !Object.hasOwn(saved.data, "spellcastingExtra") || Object.hasOwn(saved.data, "spellcastingExpanded")) return null;
  const current = catalog.filter(value => value.id === saved.id);
  if (current.length !== 1) return null;
  const target = current[0];
  if (!version.safeParse(target.version).success || target.version <= saved.version || target.system_id !== saved.system_id
    || target.content_type !== saved.content_type || target.slug !== saved.slug || target.name !== saved.name
    || target.source !== saved.source || target.scope !== saved.scope || target.owner_id !== saved.owner_id
    || Object.hasOwn(target.data, "spellcastingExtra") || !Object.hasOwn(target.data, "spellcastingExpanded")) return null;
  if (!subclassSpellcastingExpandedSchema.safeParse(saved.data.spellcastingExtra).success
    || !subclassSpellcastingExpandedSchema.safeParse(target.data.spellcastingExpanded).success
    || !equalEquipmentIntent(saved.data.spellcastingExtra, target.data.spellcastingExpanded)
    || !equalEquipmentIntent(saved.effects, target.effects)) return null;
  const oldData = { ...saved.data }, newData = { ...target.data };
  delete oldData.spellcastingExtra; delete newData.spellcastingExpanded;
  if (!equalEquipmentIntent(oldData, newData)) return null;
  return Object.freeze({ occurrence_id: selected[0].occurrence_id!, subclass_ref_id: ref.id, content_id: saved.id,
    expected_content_version: saved.version, target_content_version: target.version, saved_name: saved.name, target_name: target.name });
}

export function subclassPreviewMatches(preview: SubclassContentUpdatePreview, candidate: FiendContentUpdateCandidate,
  accountId: string, characterId: string, actionRevision: string): boolean {
  return preview.actor_id === accountId && preview.character_id === characterId
    && preview.saved_name === candidate.saved_name && preview.target_name === candidate.target_name
    && preview.fields.class_slug === "warlock" && preview.fields.occurrence_id === candidate.occurrence_id
    && preview.fields.subclass_ref_id === candidate.subclass_ref_id && preview.fields.content_id === candidate.content_id
    && preview.fields.expected_content_version === candidate.expected_content_version
    && preview.fields.target_content_version === candidate.target_content_version
    && preview.fields.expected_action_revision === actionRevision;
}
