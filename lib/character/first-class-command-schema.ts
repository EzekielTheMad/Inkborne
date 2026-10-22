import { z } from "zod";
import { classOriginInstantMicros } from "./class-origin-command-schema";
import { boundedClassRoleJson } from "./class-role-effects-schema";

// Finite transport shapes only; these do not establish native plan or Auth authority.
const uuid = z.string().regex(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/);
const intentSchema = z.strictObject({
  contract_version: z.literal(1), command: z.literal("add_class"),
  character_id: uuid, operation_id: uuid,
  expected_action_revision: z.literal("0"), expected_class_revision: z.literal("0"),
  fields: z.strictObject({ content_id: uuid, content_version: z.number().int().min(1).max(2147483647), subclass: z.null() }),
});
export type FirstClassIntent = Readonly<Omit<z.infer<typeof intentSchema>, "fields"> & {
  fields: Readonly<z.infer<typeof intentSchema>["fields"]>;
}>;

function bounded(value: unknown, maximum: number): boolean {
  return boundedClassRoleJson(value) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= maximum;
}

/** Copies and freezes the original finite request before an asynchronous boundary. */
export function parseFirstClassIntent(input: unknown): FirstClassIntent | null {
  try {
    if (!bounded(input, 32768)) return null;
    const parsed = intentSchema.safeParse(input);
    return parsed.success ? Object.freeze({ ...parsed.data, fields: Object.freeze(parsed.data.fields) }) : null;
  } catch { return null; }
}

/** Exact finite JSON values; object key order is irrelevant and nothing is normalized. */
export function sameFirstClassIntent(left: unknown, right: unknown): boolean {
  const a = parseFirstClassIntent(left), b = parseFirstClassIntent(right);
  return a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b);
}

const instant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/)
  .refine(value => classOriginInstantMicros(value) !== null);
const receiptSchema = z.strictObject({
  receipt_version: z.literal(1), receipt_kind: z.literal("class_transition"),
  operation_id: uuid, verified_actor_id: uuid, target_character_id: uuid, accepted_at: instant,
  canonical_intent: intentSchema,
  before_action_revision: z.literal("0"), after_action_revision: z.literal("1"),
  before_class_revision: z.literal("0"), after_class_revision: z.literal("1"), confirmation: z.null(),
}).superRefine((receipt, context) => {
  if (receipt.operation_id !== receipt.canonical_intent.operation_id
    || receipt.target_character_id !== receipt.canonical_intent.character_id)
    context.addIssue({ code: "custom", message: "First-class receipt identity mismatch" });
});
export type FirstClassReceipt = z.infer<typeof receiptSchema>;

/** Nontransforming strict receipt validation, including the raw canonical intent. */
export function parseFirstClassReceipt(input: unknown): FirstClassReceipt | null {
  try {
    if (!bounded(input, 65536)) return null;
    const parsed = receiptSchema.safeParse(input);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export const firstClassCommandResponseSchema = z.union([
  z.strictObject({ status: z.enum(["applied", "replayed", "recorded"]), receipt: receiptSchema }),
  z.strictObject({ status: z.enum(["invalid", "absent"]) }),
]);
export type FirstClassCommandResult = z.infer<typeof firstClassCommandResponseSchema>
  | { status: "intent_conflict" }
  | { status: "unavailable"; reason: "character_class_unavailable" };

/** Minimal action-to-UI acknowledgement; no context, receipt or privileged evidence. */
export type FirstClassUIResult =
  | { status: "confirmed"; account_id: string; character_id: string; operation_id: string }
  | { status: "unavailable" | "invalid" | "intent_conflict" | "absent" | "disabled" };
