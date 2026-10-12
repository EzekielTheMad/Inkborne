import { z } from "zod";
import { classRoleRevisionSchema } from "./class-role-effects-schema";
import { classOriginOrderSchema } from "./class-origin-command-schema";

/** Internal advisory proof only: shape never authenticates or enables a writer. */
export const CLASS_ORIGIN_REVISION_EVENT_MAX_BYTES = 8 * 1024 * 1024;
export function boundedClassOriginRevisionJson(value: unknown): boolean {
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
  return visit(value, 0) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= CLASS_ORIGIN_REVISION_EVENT_MAX_BYTES;
}
/** Call only after finite bounded JSON admission. Arrays retain significant order. */
export function canonicalClassOriginRevision(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalClassOriginRevision).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalClassOriginRevision(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
export const sameClassOriginRevision = (a: unknown, b: unknown) => canonicalClassOriginRevision(a) === canonicalClassOriginRevision(b);
const uuid = z.string().uuid(), raw = z.record(z.string(), z.unknown());
const common = {
  event_version: z.literal(1), mode: z.literal("metadata_only_confirm"), acceptance_id: uuid,
  transaction_id: z.string().regex(/^[1-9]\d{0,19}$/).refine(value => /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= BigInt("18446744073709551615")),
  target_character_id: uuid, verified_actor_id: uuid, operation_id: uuid,
  before_action_revision: classRoleRevisionSchema, after_action_revision: classRoleRevisionSchema,
  origin_transition_key: z.tuple([uuid]), occurrence_transition_key: z.tuple([uuid]),
  before_parent: raw, expected_after_parent: raw, before_order: classOriginOrderSchema,
};
export const classOriginRevisionEventSchema = z.discriminatedUnion("phase", [
  z.strictObject({ ...common, phase: z.literal("pending"), observed_parent: z.null(), observed_order: z.null() }),
  z.strictObject({ ...common, phase: z.literal("assigned"), observed_parent: z.null(), observed_order: z.null() }),
  z.strictObject({ ...common, phase: z.literal("observed"), observed_parent: raw, observed_order: classOriginOrderSchema }),
]).superRefine((event, context) => {
  if (!boundedClassOriginRevisionJson(event)) { context.addIssue({ code: "custom", message: "Finite aggregate event exceeds 8MiB" }); return; }
  if (!classRoleRevisionSchema.safeParse(event.before_action_revision).success || !classRoleRevisionSchema.safeParse(event.after_action_revision).success) return;
  const before = { ...event.before_parent }, after = { ...event.expected_after_parent };
  delete before.action_revision; delete after.action_revision;
  if (BigInt(event.after_action_revision) !== BigInt(event.before_action_revision) + BigInt(1)
    || event.before_parent.action_revision !== event.before_action_revision || event.expected_after_parent.action_revision !== event.after_action_revision
    || event.before_parent.id !== event.target_character_id || event.expected_after_parent.id !== event.target_character_id
    || event.before_parent.user_id !== event.verified_actor_id || event.expected_after_parent.user_id !== event.verified_actor_id
    || event.origin_transition_key[0] !== event.target_character_id
    || event.before_order.character_id !== event.target_character_id || event.before_order.producer_revision !== event.before_action_revision
    || !sameClassOriginRevision(before, after)) context.addIssue({ code: "custom", message: "Exact metadata-only parent identity/revision required" });
  if (event.phase === "observed" && (!sameClassOriginRevision(event.observed_parent, event.expected_after_parent)
    || !sameClassOriginRevision(event.observed_order, { ...event.before_order, producer_revision: event.after_action_revision }))) {
    context.addIssue({ code: "custom", message: "Actual parent/order observation differs" });
  }
});
/** Bounds precede recursive shape validation; no browser/API import is supplied. */
export function parseClassOriginRevisionEvent(input: unknown) {
  if (!boundedClassOriginRevisionJson(input)) return null;
  const parsed = classOriginRevisionEventSchema.safeParse(input); return parsed.success ? parsed.data : null;
}
export type ClassOriginRevisionEvent = z.infer<typeof classOriginRevisionEventSchema>;
