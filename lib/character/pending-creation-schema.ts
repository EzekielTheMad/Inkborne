import { z } from "zod";
import { boundedClassRoleJson } from "@/lib/character/class-role-effects-schema";

export const creationUUID = z.string().regex(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/);
export const pendingCreationIntentSchema = z.strictObject({
  contract_version: z.literal(1), operation_id: creationUUID, command: z.literal("create_character"),
  fields: z.strictObject({
    name: z.string().min(1).max(100).refine(value => value === value.trim()),
    system_id: creationUUID, campaign_id: z.null(),
  }),
});
export type CreationIntent = z.infer<typeof pendingCreationIntentSchema>;
export type CreationUIResult =
  | { status: "confirmed"; account_id: string; operation_id: string; character_id: string }
  | { status: "unavailable" | "invalid" | "unsupported" | "intent_conflict" | "absent" | "disabled" };
export const creationUIResultSchema = z.union([
  z.strictObject({ status: z.literal("confirmed"), account_id: creationUUID,
    operation_id: creationUUID, character_id: creationUUID }),
  z.strictObject({ status: z.enum(["unavailable", "invalid", "unsupported", "intent_conflict", "absent", "disabled"]) }),
]);

export function parseCreationIntent(value: unknown): CreationIntent | null {
  try {
    if (!boundedClassRoleJson(value) || new TextEncoder().encode(JSON.stringify(value)).byteLength > 32768) return null;
    const result = pendingCreationIntentSchema.safeParse(value);
    if (!result.success) return null;
    Object.freeze(result.data.fields);
    return Object.freeze(result.data);
  } catch { return null; }
}

export function sameCreationIntent(left: CreationIntent, right: CreationIntent): boolean {
  return left.contract_version === right.contract_version && left.command === right.command
    && left.operation_id === right.operation_id && left.fields.name === right.fields.name
    && left.fields.system_id === right.fields.system_id && left.fields.campaign_id === right.fields.campaign_id;
}
