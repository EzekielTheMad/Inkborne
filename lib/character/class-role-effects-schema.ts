import { z } from "zod";
import { effectSchema } from "@/lib/schemas/effects";
import { getContentTypeSchema } from "@/lib/schemas/content-types";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";

/** Internal advisory evidence DTO. Structural validity is NEVER read/write authority. */
export const CLASS_ROLE_ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
export type ClassRoleAbility = typeof CLASS_ROLE_ABILITIES[number];
export const classRoleRevisionSchema = z.string().regex(/^(0|[1-9]\d{0,18})$/)
  .refine(value => /^(0|[1-9]\d{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n, "PostgreSQL bigint revision exceeded");
const version = z.number().int().min(1).max(2147483647);
const slug = z.string().min(1).max(200);
const rawObject = z.record(z.string(), z.unknown());
const instant = z.string().datetime({ offset: true });
const rawEffects = z.array(rawObject).max(256).superRefine((values, context) => {
  if (!z.array(effectSchema).safeParse(values).success) context.addIssue({ code: "custom", message: "Invalid canonical raw effects" });
});
export const classRolePinSchema = z.strictObject({
  id: z.string().uuid(), character_id: z.string().uuid(), content_id: z.string().uuid(), content_version: version,
  context: rawObject, choice_source: z.string().nullable(),
  resolved: z.strictObject({ id: z.string().uuid(), system_id: z.string().uuid(), content_type: slug, slug, name: z.string().min(1),
    version, source: z.enum(["srd", "homebrew"]), scope: z.enum(["platform", "personal", "shared"]), owner_id: z.string().uuid().nullable(),
    data: rawObject, effects: rawEffects }),
}).superRefine((pin, context) => {
  if (!getContentTypeSchema(pin.resolved.content_type)?.safeParse(pin.resolved.data).success) context.addIssue({ code: "custom", message: "Invalid canonical content data" });
});
export const classRoleOccurrenceSchema = z.strictObject({
  id: z.string().uuid(), character_id: z.string().uuid(), system_id: z.string().uuid(), content_id: z.string().uuid(), content_version: version,
  class_slug: slug, lifecycle: z.enum(["provisional", "accepted", "ended"]), selected_at: instant,
  acquired_character_level: z.number().int().min(1).max(20).nullable(), acquisition_operation_id: z.string().uuid().nullable(),
  accepted_at: instant.nullable(), ended_at: instant.nullable(),
});
export const classRoleConfirmationIntentSchema = z.strictObject({
  contract_version: z.literal(1), command: z.literal("confirm_origin"), character_id: z.string().uuid(),
  operation_id: z.string().uuid(), expected_revision: classRoleRevisionSchema, selected_occurrence_id: z.string().uuid(),
});
export const classRoleConfirmationReceiptSchema = z.strictObject({
  canonical_intent: classRoleConfirmationIntentSchema, applied_revision: classRoleRevisionSchema, accepted_at: instant,
});
const proof = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("confirmation"), receipt: classRoleConfirmationReceiptSchema }),
  z.strictObject({ kind: z.literal("copy"), copy_operation_id: z.string().uuid(), source_command_revision: classRoleRevisionSchema,
    source_occurrence: classRoleOccurrenceSchema, source_confirmation: classRoleConfirmationReceiptSchema }),
]);
export const classRoleOriginSchema = z.strictObject({
  schema_version: z.literal(1), character_id: z.string().uuid(), system_id: z.string().uuid(), command_revision: classRoleRevisionSchema,
  origin_status: z.enum(["draft", "recorded", "legacy_unavailable"]), origin_occurrence_id: z.string().uuid().nullable(),
  creation_provenance: z.enum(["new_character", "fresh_draft_copy", "confirmed_copy"]).nullable(),
  creation_operation_id: z.string().uuid().nullable(), source_draft_operation_id: z.string().uuid().nullable(), role_proof: proof.nullable(),
});
// class-save-occurrences-v1 is advisory future manifest protocol, NOT a producer allowlist or attestation.
export const classRoleSaveManifestSchema = z.strictObject({
  schema_version: z.literal(1), compiler_id: z.enum(["private-basic-class-v1", "class-save-occurrences-v1"]),
  content_id: z.string().uuid(), content_version: version, system_id: z.string().uuid(),
  saving_throws_snapshot: z.array(z.enum(CLASS_ROLE_ABILITIES)).max(6), effects_snapshot: rawEffects,
  occurrences: z.array(z.strictObject({ effect_index: z.number().int().min(0).max(255), kind: z.enum(["starting_save", "independent_save"]),
    ability: z.enum(CLASS_ROLE_ABILITIES), stat_slug: slug, effect_snapshot: rawObject })).max(256),
}).superRefine((manifest, context) => {
  if (new TextEncoder().encode(JSON.stringify(manifest)).byteLength > 131072) context.addIssue({ code: "custom", message: "Save metadata exceeds 128KiB" });
});
export const classRoleEvidenceSchema = z.strictObject({
  contract_version: z.literal(1), character: z.strictObject({ id: z.string().uuid(), system_id: z.string().uuid(),
    classes: z.array(z.strictObject({ occurrence_id: z.string().uuid(), slug, level: z.number().int().min(1).max(20), subclass: slug.optional() })).max(20) }),
  system: z.strictObject({ id: z.string().uuid(), slug: z.literal("dnd-5e-2014"), status: z.literal("published"), schema_definition: rawObject }),
  current_proficiency_bonus: z.number().finite(), origin: classRoleOriginSchema.nullable(),
  occurrences: z.array(classRoleOccurrenceSchema).max(256), sources: z.array(classRolePinSchema).max(128),
  manifests: z.array(classRoleSaveManifestSchema).max(128),
}).superRefine((evidence, context) => {
  const rules = systemSchemaDefinitionSchema.safeParse(evidence.system.schema_definition);
  if (!rules.success) { context.addIssue({ code: "custom", message: "Canonical system schema required" }); return; }
  const abilities = rules.data.ability_scores.map(value => value.slug);
  const proficient = rules.data.proficiency_levels.filter(value => value.slug === "proficient");
  if (abilities.length !== 6 || new Set(abilities).size !== 6 || CLASS_ROLE_ABILITIES.some(value => !abilities.includes(value))
    || proficient.length !== 1 || proficient[0].multiplier !== 1) context.addIssue({ code: "custom", message: "Exactly six published abilities and proficient multiplier1 required" });
  // No six saving-throw derived-stat requirement: actual renderer uses exact grant keys.
});
export type ClassRoleEvidence = z.infer<typeof classRoleEvidenceSchema>;
export type ClassRoleRawEffect = Record<string, unknown>;
export type ClassRoleConfirmationIntent = z.infer<typeof classRoleConfirmationIntentSchema>;
export type ClassRoleConfirmationReceipt = z.infer<typeof classRoleConfirmationReceiptSchema>;

/** Reject non-JSON/cyclic/unbounded input before Zod or canonical schemas recurse. */
export function boundedClassRoleJson(value: unknown): boolean {
  const ancestors = new Set<object>(); let visited = 0;
  function visit(current: unknown, depth: number): boolean {
    if (++visited > 100000 || depth > 40) return false;
    if (current === null || typeof current === "string" || typeof current === "boolean") return true;
    if (typeof current === "number") return Number.isFinite(current);
    if (typeof current !== "object" || ancestors.has(current)) return false;
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) return false;
    ancestors.add(current);
    const valid = (Array.isArray(current) ? Array.from(current) : Object.values(current)).every(item => visit(item, depth + 1));
    ancestors.delete(current); return valid;
  }
  return visit(value, 0) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= 4194304;
}
