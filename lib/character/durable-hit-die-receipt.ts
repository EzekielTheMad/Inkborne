import "server-only";
import { z } from "zod";
import { actionRevisionSchema, hitDiePlanResultSchema, hitDieRequestSchema, hitDieSnapshotSchema, instantSchema } from "./durable-hit-die-schema";
import { serializeHitDieIntent } from "./durable-hit-die-canonical";

const planned = hitDiePlanResultSchema.options[2];
export const acceptedRollTotalSchema = z.number().int().min(-2147483648).max(2147483647);
// Native precision is separate from the existing precision-3 planner DTO.
export const nativeHitDieInstantSchema = z.string().regex(/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
function receiptMicros(raw: string): bigint {
  const projected = raw.slice(0, 23) + "Z";
  const millis = Date.parse(projected);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== projected) throw new Error("Invalid native receipt instant");
  return BigInt(millis) * BigInt(1000) + BigInt(raw.slice(23, 26));
}
export const hitDieReceiptSchema = z.strictObject({
  contract_version: z.literal(1), canonical_version: z.literal(1),
  request: hitDieRequestSchema, canonical_intent: z.string(),
  verified_actor_id: z.uuid(), dependency_snapshot: hitDieSnapshotSchema,
  dependency_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  before_revision: actionRevisionSchema, after_revision: actionRevisionSchema,
  linked_roll_id: z.uuid(), roll: planned.shape.roll,
  patch: planned.shape.patch, evaluated_at: instantSchema,
  native_evaluated_at: nativeHitDieInstantSchema, accepted_at: nativeHitDieInstantSchema,
  valid_until: instantSchema.nullable(),
}).superRefine((receipt, ctx) => {
  const group = receipt.roll.groups[0];
  const face = group.rolls[0];
  const mod = receipt.roll.modifier;
  const expression = `1d${group.sides}${mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : ""}`;
  try {
    const evaluated = receiptMicros(receipt.native_evaluated_at);
    const accepted = receiptMicros(receipt.accepted_at);
    if (receipt.native_evaluated_at.slice(0, 23) + "Z" !== receipt.evaluated_at || accepted < evaluated ||
      (receipt.valid_until !== null && accepted >= receiptMicros(receipt.valid_until.slice(0, -1) + "000Z"))) throw new Error("Inconsistent native receipt clocks");
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid native receipt clocks" });
  }
  if (!acceptedRollTotalSchema.safeParse(receipt.roll.total).success || face > group.sides || group.kept[0] !== face ||
      receipt.roll.total !== face + mod || receipt.roll.request.expression !== expression ||
      receipt.roll.request.meta.class_slug !== receipt.request.class_slug || receipt.roll.request.meta.con_mod !== mod ||
      receipt.canonical_intent !== serializeHitDieIntent(receipt.request) ||
      receipt.request.dependency_fingerprint !== receipt.dependency_fingerprint ||
      receipt.before_revision !== receipt.request.expected_revision ||
      BigInt(receipt.after_revision) !== BigInt(receipt.before_revision) + BigInt(1) ||
      receipt.dependency_snapshot.character.id !== receipt.request.character_id ||
      receipt.dependency_snapshot.character.owner_id !== receipt.verified_actor_id ||
      receipt.dependency_snapshot.character.revision !== receipt.before_revision ||
      receipt.roll.rolled_at !== receipt.evaluated_at) {
    ctx.addIssue({ code: "custom", message: "Inconsistent accepted receipt" });
  }
});
export type HitDieReceipt = z.infer<typeof hitDieReceiptSchema>;
const refusal = z.strictObject({ status: z.enum(["operation_conflict", "revision_conflict", "invalid", "expired", "unavailable", "disabled", "inaccessible", "absent"]) });
export const hitDieKernelResponseSchema = z.union([
  z.strictObject({ status: z.literal("committed"), receipt: hitDieReceiptSchema }),
  z.strictObject({ status: z.literal("replayed"), receipt: hitDieReceiptSchema }), refusal,
]);
export type HitDieKernelResponse = z.infer<typeof hitDieKernelResponseSchema>;

/** Receipt absence/access loss never cancels an in-flight commit. No retry IDs. */
export function interpretHitDieResponse(raw: unknown, source: "lookup" | "commit"): "accepted" | "rejected" | "unresolved" {
  const parsed = hitDieKernelResponseSchema.safeParse(raw);
  if (!parsed.success) return "unresolved";
  if (parsed.data.status === "committed" || parsed.data.status === "replayed") return "accepted";
  if (source === "lookup" || parsed.data.status === "inaccessible" || parsed.data.status === "absent") return "unresolved";
  return "rejected";
}
