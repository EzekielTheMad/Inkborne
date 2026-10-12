import { z } from "zod";
import { classOriginAcceptanceSchema, classOriginGraphSchema, classOriginInstantMicros, classOriginReceiptSchema, parseClassOriginRequest } from "./class-origin-command-schema";
import { boundedClassOriginRevisionJson, classOriginRevisionEventSchema } from "./class-origin-revision-event-schema";

/** Internal source/model evidence ONLY. Neither a context nor this DTO is Auth. */
const uuid = z.string().uuid(), raw = z.record(z.string(), z.unknown());
const instant = z.string().datetime({ offset: true }).refine(value => classOriginInstantMicros(value) !== null);
export const classConfirmationContextSchema = z.strictObject({
  context_version: z.literal(1), actor_id: uuid, session_id: uuid,
  jwt_expires_at: instant.refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)),
});
export const classConfirmationHistorySchema = z.strictObject({
  creation_row: z.strictObject({ verified_actor_id: uuid, operation_id: uuid, target_character_id: uuid, receipt: classOriginReceiptSchema }),
  bootstrap: classOriginAcceptanceSchema, selection: classOriginAcceptanceSchema,
  selection_receipt_row: z.strictObject({ character_id: uuid, operation_id: uuid, receipt: classOriginReceiptSchema }),
});
export const classConfirmationSourcesSchema = z.strictObject({
  definitions: z.array(raw).max(4096), versions: z.array(raw).max(4096),
  campaign: raw.nullable(), members: z.array(raw).max(4096), shares: z.array(raw).max(4096),
  system: raw,
});
// SQL derives these phases from locked rows/native time. Tests inject them, never a browser.
export const classConfirmationWorldSchema = z.strictObject({
  context_at_entry: classConfirmationContextSchema, context_after_wait: classConfirmationContextSchema,
  context_before_return: classConfirmationContextSchema, context_at_acceptance: classConfirmationContextSchema,
  after_wait_time: instant, before_return_time: instant, acceptance_time: instant,
  owned_parent: raw, stored_receipt: classOriginReceiptSchema.nullable(),
  before_graph: classOriginGraphSchema.nullable(), history: classConfirmationHistorySchema.nullable(),
  sources_before_wait: classConfirmationSourcesSchema.nullable(), sources_after_wait: classConfirmationSourcesSchema.nullable(),
  acceptance_id: uuid, transaction_id: z.string().regex(/^[1-9]\d{0,19}$/)
    .refine(value => /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= BigInt("18446744073709551615")),
});
export const classConfirmationModelResultSchema = z.discriminatedUnion("mode", [
  z.strictObject({ status: z.literal("model_checked"), mode: z.literal("replayed"), receipt: classOriginReceiptSchema, trace: z.array(z.string()) }),
  z.strictObject({ status: z.literal("model_checked"), mode: z.literal("applied"), receipt: classOriginReceiptSchema,
    acceptance: classOriginAcceptanceSchema, event: classOriginRevisionEventSchema, graph: classOriginGraphSchema, trace: z.array(z.string()) }),
]);
export function parseClassConfirmationIntent(value: unknown) {
  const request = parseClassOriginRequest(value);
  return request?.command === "confirm_origin" ? request : null;
}
export function parseClassConfirmationWorld(value: unknown) {
  if (!boundedClassOriginRevisionJson(value)) return null;
  const result = classConfirmationWorldSchema.safeParse(value); return result.success ? result.data : null;
}
export type ClassConfirmationWorld = z.infer<typeof classConfirmationWorldSchema>;
export type ClassConfirmationSources = z.infer<typeof classConfirmationSourcesSchema>;
