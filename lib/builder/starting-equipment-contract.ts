import { z } from "zod";

const stringMap = z.record(z.string().max(150), z.string().min(1).max(300)).refine(
  value => Object.keys(value).length <= 100, "Too many equipment selections",
);
export const equipmentSelectionsSchema = z.object({
  selections: stringMap, picks: stringMap, confirmed: z.boolean().optional(),
}).strict();
const sourceSchema = z.object({ id: z.string().uuid(), version: z.number().int().positive() }).strict();
export const equipmentRequestSchema = z.object({
  characterId: z.string().uuid(),
  selections: equipmentSelectionsSchema,
  sources: z.object({ class: sourceSchema, background: sourceSchema.nullable() }).strict(),
}).strict();
export type EquipmentRequest = z.infer<typeof equipmentRequestSchema>;
export const equipmentPlanSchema = z.object({
  items: z.array(z.object({
    content_id: z.string().uuid().nullable(), content_version: z.number().int().positive().nullable(),
    name: z.string().min(1).max(500), content_type: z.enum(["weapon", "armor", "item"]),
    quantity: z.number().int().positive().max(10000),
  }).strict().refine(item => (item.content_id === null) === (item.content_version === null))).max(200),
  currency: z.object({ cp: z.number().int().nonnegative().max(1000000).optional(),
    sp: z.number().int().nonnegative().max(1000000).optional(), ep: z.number().int().nonnegative().max(1000000).optional(),
    gp: z.number().int().nonnegative().max(1000000).optional(), pp: z.number().int().nonnegative().max(1000000).optional(),
  }).strict(),
}).strict();
export function equipmentRequestIntent(request: EquipmentRequest) {
  return { selections: { selections: request.selections.selections, picks: request.selections.picks }, sources: request.sources };
}
// JSON object key ordering is not intent. Array order remains meaningful.
export function equalEquipmentIntent(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "undefined";
  };
  return canonical(left) === canonical(right);
}
export const startingEquipmentReceiptSchema = z.object({
  grant_id: z.string().uuid(), inventory_ids: z.array(z.string().uuid()),
  plan: equipmentPlanSchema, awarded_at: z.string().min(1),
}).strict();
export const startingEquipmentResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("awarded"), receipt: startingEquipmentReceiptSchema }).strict(),
  ...(["unavailable", "not_eligible", "already_completed", "conflict", "uncertain"] as const).map(status => z.object({ status: z.literal(status) }).strict()),
]);
export type StartingEquipmentResult = z.infer<typeof startingEquipmentResultSchema>;

export type StartingEquipmentCompletion =
  | { status: "awarded"; receipt: z.infer<typeof startingEquipmentReceiptSchema> }
  | { status: "inherited_completion" };
