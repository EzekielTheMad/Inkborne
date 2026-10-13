import { z } from "zod";
import { parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { nativeInstantMicros } from "@/lib/character/durable-hit-die-kernel-model";
import { nativeHitDieInstantSchema } from "@/lib/character/durable-hit-die-receipt";

// Service-internal, advisory structure ONLY; no app import, Auth issuer or writer.
export const ARCANUM_REQUEST_MAX_BYTES = 8192;
export const ARCANUM_READ_MAX_BYTES = 8388608;
const uuid = z.uuid().refine(value => value === value.toLowerCase());
const version = z.number().int().min(1).max(2147483647);
const validRevision = (value: string) => /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 19 && BigInt(value) <= BigInt("9223372036854775807");
const revision = z.string().max(19).regex(/^(0|[1-9][0-9]*)$/).refine(validRevision);
const count = z.string().max(19).regex(/^(0|[1-9][0-9]*)$/);
const nativeTime = nativeHitDieInstantSchema.refine(value => {
  try { nativeInstantMicros(value); return true; } catch { return false; }
});
const jsonObject = z.record(z.string(), z.json());
const slug = z.string().min(1).max(500).refine(value => value.trim().length > 0);
export const arcanumRequestSchema = z.strictObject({
  command_version: z.literal(1), command: z.literal("first_select"), operation_id: uuid,
  expected_revision: revision, earned_occurrence_id: uuid, feature_grant_id: uuid,
  spell_content_id: uuid, spell_version: version,
});
export type ArcanumRequest = z.infer<typeof arcanumRequestSchema>;
const snapshot = z.strictObject({
  content_id: uuid, version, system_id_snapshot: uuid, content_type_snapshot: z.enum(["class", "subclass", "feature", "spell"]),
  slug_snapshot: slug, name_snapshot: z.string().min(1), data_snapshot: jsonObject, effects_snapshot: z.array(z.json()),
  source_snapshot: z.enum(["srd", "homebrew"]), scope_snapshot: z.enum(["platform", "personal", "shared"]),
  owner_id_snapshot: uuid.nullable(), created_at: z.iso.datetime({ offset: true }),
});
const grant = z.object({ id: uuid, character_id: uuid, controller_ref_id: uuid, feature_slug: slug,
  feature_content_id: uuid, feature_version: version, unlock_level: z.number().int().min(1).max(20),
}).catchall(z.json()); // Preserve original extensions; never manufacture lineage from these fields.

export const arcanumCaptureSchema = z.strictObject({
  schema_version: z.literal(1), capture_kind: z.literal("first_choice"),
  selection_id: uuid, character_id: uuid, system_id: uuid, earned_occurrence_id: uuid, origin_id: uuid,
  operation_id: uuid, original_actor_id: uuid, accepted_at: nativeTime, before_revision: revision, after_revision: revision,
  original_feature_grant_id: uuid, controller_ref_id: uuid, controller_content_id: uuid, controller_version: version,
  derived_feature_ref_id: uuid, feature_content_id: uuid, feature_version: version, feature_slug: slug,
  unlock_level: z.number().int().min(1).max(20), spell_content_id: uuid, spell_version: version,
  controller_snapshot: snapshot, feature_snapshot: snapshot, spell_snapshot: snapshot,
  captured_grant: grant, canonical_intent: arcanumRequestSchema,
}).superRefine((value, ctx) => {
  const request = value.canonical_intent, g = value.captured_grant;
  const pairs = [[value.controller_snapshot, value.controller_content_id, value.controller_version],
    [value.feature_snapshot, value.feature_content_id, value.feature_version],
    [value.spell_snapshot, value.spell_content_id, value.spell_version]] as const;
  let valid = validRevision(value.before_revision) && validRevision(value.after_revision) && BigInt(value.before_revision) < BigInt("9223372036854775807")
    && BigInt(value.after_revision) === BigInt(value.before_revision) + BigInt(1)
    && request.operation_id === value.operation_id && request.expected_revision === value.before_revision
    && request.earned_occurrence_id === value.earned_occurrence_id && request.feature_grant_id === value.original_feature_grant_id
    && request.spell_content_id === value.spell_content_id && request.spell_version === value.spell_version
    && g.id === value.original_feature_grant_id && g.character_id === value.character_id && g.controller_ref_id === value.controller_ref_id
    && g.feature_content_id === value.feature_content_id && g.feature_version === value.feature_version
    && g.feature_slug === value.feature_slug && g.unlock_level === value.unlock_level
    && ["class", "subclass"].includes(value.controller_snapshot.content_type_snapshot)
    && value.feature_snapshot.content_type_snapshot === "feature" && value.spell_snapshot.content_type_snapshot === "spell"
    && value.feature_snapshot.slug_snapshot === value.feature_slug;
  for (const [raw, id, v] of pairs) valid = valid && raw.content_id === id && raw.version === v
    && raw.system_id_snapshot === value.system_id && parseContentVersionSnapshot(raw) !== null;
  if (!valid) ctx.addIssue({ code: "custom", message: "Captured raw/intent/grant identity or revision mismatch" });
});
export type ArcanumCapture = z.infer<typeof arcanumCaptureSchema>;
export const arcanumReceiptSchema = z.strictObject({
  receipt_version: z.literal(1), capture_kind: z.literal("first_choice"), character_id: uuid,
  operation_id: uuid, selection_id: uuid, earned_occurrence_id: uuid, origin_id: uuid,
  original_actor_id: uuid, accepted_at: nativeTime, before_revision: revision, after_revision: revision,
  canonical_intent: arcanumRequestSchema, capture: arcanumCaptureSchema,
}).superRefine((value, ctx) => {
  const c = value.capture;
  if (value.character_id !== c.character_id || value.selection_id !== c.selection_id || value.operation_id !== c.operation_id
    || value.earned_occurrence_id !== c.earned_occurrence_id || value.origin_id !== c.origin_id
    || value.original_actor_id !== c.original_actor_id || value.accepted_at !== c.accepted_at
    || value.before_revision !== c.before_revision || value.after_revision !== c.after_revision
    || !sameArcanumJson(value.canonical_intent, c.canonical_intent)) {
    ctx.addIssue({ code: "custom", message: "Original receipt/capture correspondence failed" });
  }
});
export type ArcanumReceipt = z.infer<typeof arcanumReceiptSchema>;
export function sameArcanumJson(left: unknown, right: unknown): boolean {
  const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered)
    : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, ordered(item)])) : value;
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}
export function assertArcanumBudget(raw: unknown, maximum = ARCANUM_READ_MAX_BYTES): void {
  const serialized = JSON.stringify(raw);
  if (typeof serialized !== "string" || new TextEncoder().encode(serialized).length > maximum) throw new Error("Arcanum payload budget exceeded");
}
export function parseArcanumRequest(raw: unknown): ArcanumRequest {
  assertArcanumBudget(raw, ARCANUM_REQUEST_MAX_BYTES); return arcanumRequestSchema.parse(raw);
}
export const arcanumReadSchema = z.strictObject({
  status: z.literal("read"), read_version: z.literal(1), character_id: uuid, system_id: uuid, revision,
  native_read_at: nativeTime, counts: z.strictObject({ selections: count, receipts: count }),
  selections: z.array(arcanumCaptureSchema), receipts: z.array(arcanumReceiptSchema), state: jsonObject,
  current_eligibility: z.strictObject({ status: z.literal("unavailable"), reason: z.literal("prerequisites_unimplemented") }),
}).superRefine((value, ctx) => {
  const selections = new Set<string>(), operations = new Set<string>(), occurrences = new Set<string>();
  let valid = /^(0|[1-9][0-9]*)$/.test(value.counts.selections) && /^(0|[1-9][0-9]*)$/.test(value.counts.receipts)
    && BigInt(value.counts.selections) === BigInt(value.selections.length)
    && BigInt(value.counts.receipts) === BigInt(value.receipts.length) && value.selections.length === value.receipts.length;
  for (const c of value.selections) {
    if (c.character_id !== value.character_id || selections.has(c.selection_id) || occurrences.has(c.earned_occurrence_id)) valid = false;
    selections.add(c.selection_id); occurrences.add(c.earned_occurrence_id);
    const pair = value.receipts.filter(r => r.selection_id === c.selection_id && r.character_id === c.character_id);
    if (pair.length !== 1 || !sameArcanumJson(pair[0].capture, c)) valid = false;
  }
  for (const r of value.receipts) {
    if (r.character_id !== value.character_id || operations.has(r.operation_id) || !selections.has(r.selection_id)) valid = false;
    operations.add(r.operation_id);
  }
  if (!valid) ctx.addIssue({ code: "custom", message: "Incomplete or foreign reciprocal selection graph" });
});
export function parseArcanumRead(raw: unknown) {
  assertArcanumBudget(raw); return arcanumReadSchema.parse(raw);
}
