import { z } from "zod";
import { monsterDataSchema } from "@/lib/schemas/content-types/monster";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";

export const CAMPAIGN_MONSTERS_ENABLED: boolean = false; // G2/G3/recovery acceptance required.
const bytes = (value: string) => new TextEncoder().encode(value).length;
function nativeText(value: string) {
  for (const character of value) { const point = character.codePointAt(0)!; if (point === 0 || point >= 0xd800 && point <= 0xdfff) return false; }
  return true;
}
export const revisionSchema = z.string().max(19).regex(/^(0|[1-9][0-9]*)$/).refine((v) => v.length <= 19 && /^(0|[1-9][0-9]*)$/.test(v) && BigInt(v) <= BigInt("9223372036854775807"));
const name = z.string().min(1).max(100).refine((v) => nativeText(v) && v.trim().length > 0 && bytes(v) <= 400);
const notes = z.string().max(8000).refine((v) => nativeText(v) && bytes(v) <= 32000);
const hp = z.number().int().min(0).max(1_000_000);
const uuid = z.string().uuid().refine((v) => v === v.toLowerCase(), "Use canonical UUID spelling");
const base = { command_version: z.literal(1), operation_id: uuid };
export const instancePatchSchema = z.strictObject({ name: name.optional(), current_hp: hp.optional(), notes: notes.optional(), archived: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, "Specify a change");
export const instanceRequestSchema = z.discriminatedUnion("command", [
  z.strictObject({ ...base, command: z.literal("create"), source_id: uuid, source_version: z.number().int().min(1).max(2147483647),
    source_digest: z.string().regex(/^[a-f0-9]{64}$/), name, current_hp: hp, notes }),
  z.strictObject({ ...base, command: z.literal("update"), instance_id: uuid, expected_revision: revisionSchema, patch: instancePatchSchema }),
]);
export type InstanceRequest = z.infer<typeof instanceRequestSchema>;
export const instanceSummarySchema = z.strictObject({ id: uuid, campaign_id: uuid, name, current_hp: hp,
  declared_max_hp: z.number().int().min(1).max(1_000_000), archived: z.boolean(), revision: revisionSchema })
  .refine((v) => v.current_hp <= v.declared_max_hp);
export type InstanceSummary = z.infer<typeof instanceSummarySchema>;
const readback = z.strictObject({ id: uuid, campaign_id: uuid, name, current_hp: hp,
  declared_max_hp: z.number().int().min(1).max(1_000_000), archived: z.boolean(), revision: revisionSchema, notes })
  .refine((v) => v.current_hp <= v.declared_max_hp);
export const instanceReceiptSchema = z.strictObject({ command_version: z.literal(1), campaign_id: uuid, operation_id: uuid,
  canonical_intent: instanceRequestSchema, instance_id: uuid, original_actor_id: uuid, accepted_at: z.iso.datetime({ offset: true }),
  outcome: z.enum(["created", "updated", "noop"]), readback }).superRefine((v, ctx) => {
  const request = v.canonical_intent;
  let valid = request.operation_id === v.operation_id && v.readback.id === v.instance_id && v.readback.campaign_id === v.campaign_id;
  if (request.command === "create") valid = valid && v.outcome === "created" && v.readback.revision === "0" && !v.readback.archived
    && v.readback.name === request.name && v.readback.current_hp === request.current_hp && v.readback.notes === request.notes;
  else {
    valid = valid && v.instance_id === request.instance_id && v.outcome !== "created"
      && BigInt(v.readback.revision) === BigInt(request.expected_revision) + (v.outcome === "updated" ? BigInt(1) : BigInt(0));
    for (const key of Object.keys(request.patch) as (keyof typeof request.patch)[]) valid = valid && v.readback[key] === request.patch[key];
  }
  if (!valid) ctx.addIssue({ code: "custom", message: "Receipt/request correspondence failed" });
});
export type InstanceReceipt = z.infer<typeof instanceReceiptSchema>;
export function sameInstanceIntent(a: unknown, b: unknown): boolean {
  const order = (v: unknown): unknown => Array.isArray(v) ? v.map(order) : v !== null && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => [k, order(value)])) : v;
  return JSON.stringify(order(a)) === JSON.stringify(order(b));
}
export function admittedMonsterSnapshot(raw: unknown, systemId: string, contentId?: string, version?: number) {
  const serialized = JSON.stringify(raw);
  if (typeof serialized !== "string" || bytes(serialized) > 131072) throw new Error("Unsupported source budget");
  const rawEnvelope = z.object({ content_id: uuid, version: z.number().int().min(1).max(2147483647), system_id_snapshot: uuid,
    content_type_snapshot: z.literal("monster"), effects_snapshot: z.array(z.unknown()).length(0), data_snapshot: z.unknown() }).parse(raw);
  if (rawEnvelope.system_id_snapshot !== systemId || (contentId && rawEnvelope.content_id !== contentId) || (version !== undefined && rawEnvelope.version !== version)) throw new Error("Source identity mismatch");
  const parsed = parseContentVersionSnapshot(raw);
  if (!parsed) throw new Error("Unsupported descriptive source");
  const data = monsterDataSchema.parse(parsed.data);
  return { data, sourceName: parsed.name, sourceVersion: parsed.version };
}
export const sourcePreviewSchema = z.strictObject({ source_id: uuid, source_version: z.number().int().min(1).max(2147483647),
  system_id: uuid, source_digest: z.string().regex(/^[a-f0-9]{64}$/), declared_max_hp: z.number().int().min(1).max(1_000_000), snapshot: z.unknown() });
export type SourcePreview = z.infer<typeof sourcePreviewSchema>;
export type InstanceDetail = InstanceSummary & { notes: string; system_id: string; source_content_id: string; source_version: number; source_digest: string; source_snapshot: unknown };
export const instanceDetailSchema = z.object({ id: uuid, campaign_id: uuid, system_id: uuid, name, notes, current_hp: hp,
  declared_max_hp: z.number().int().min(1).max(1_000_000), archived: z.boolean(), revision: revisionSchema,
  source_content_id: uuid, source_version: z.number().int().min(1).max(2147483647), source_digest: z.string().regex(/^[a-f0-9]{64}$/), source_snapshot: z.unknown() })
  .refine((v) => v.current_hp <= v.declared_max_hp);
export type InstanceActionResponse = { status: "saved"; receipt: InstanceReceipt } | { status: "absent" } |
  { status: "error" | "conflict" | "uncertain"; message: string };

export function parseInstanceActionResponse(raw: unknown, campaignId: string, operationId: string, intent?: InstanceRequest): InstanceActionResponse {
  const response = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("saved"), receipt: instanceReceiptSchema }),
    z.strictObject({ status: z.literal("absent") }), z.strictObject({ status: z.enum(["error", "conflict", "uncertain"]), message: z.string().min(1).max(500) })]).parse(raw);
  if (response.status === "saved" && (response.receipt.campaign_id !== campaignId || response.receipt.operation_id !== operationId || (intent && !sameInstanceIntent(intent, response.receipt.canonical_intent)))) throw new Error("Unexpected command receipt");
  return response;
}
