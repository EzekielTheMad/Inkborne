import { z } from "zod";
import { actionRevisionSchema } from "@/lib/character/durable-hit-die-schema";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";

const object = z.record(z.string(), z.json());
export const manualHpPatchSchema = z.strictObject({
  current_hp: z.number().int().positive().max(2147483647).optional(),
  temp_hp: z.number().int().nonnegative().max(2147483647).optional(),
}).refine(value => Object.keys(value).length > 0);
export const manualHpParentSchema = z.strictObject({
  id: z.uuid(), user_id: z.uuid(), system_id: z.uuid(), campaign_id: z.uuid().nullable(),
  archived: z.literal(false), level: z.number().int().min(1).max(20),
  choices: object, state: object, base_stats: object, action_revision: actionRevisionSchema,
});
export const manualHpRequestSchema = z.strictObject({
  character_id: z.uuid(), expected_parent: manualHpParentSchema,
  expected_max_hp: z.number().int().positive().max(2147483647), patch: manualHpPatchSchema,
}).refine(value => value.character_id === value.expected_parent.id);
export const campaignAssignmentRequestSchema = z.strictObject({
  character_id: z.uuid(), campaign_id: z.uuid(), expected_revision: actionRevisionSchema,
  expected_campaign_id: z.null(),
});
export const basicSheetResponseSchema = z.union([
  z.strictObject({ status: z.enum(["applied", "unchanged"]), character_id: z.uuid(), actor_id: z.uuid(),
    revision: actionRevisionSchema, state: object, campaign_id: z.uuid().nullable() }),
  z.strictObject({ status: z.enum(["conflict", "unavailable", "invalid", "unknown"]) }),
]);
export type ManualHpRequest = z.infer<typeof manualHpRequestSchema>;
export type BasicSheetResponse = z.infer<typeof basicSheetResponseSchema>;

/** Raw saved parent only: UI defaults and derived overlays are not a preimage. */
export function manualHpParent(character: CharacterWithSystem, state: CharacterState) {
  const revision = (character as CharacterWithSystem & { action_revision?: string | number }).action_revision;
  return manualHpParentSchema.parse({ id: character.id, user_id: character.user_id, system_id: character.system_id,
    campaign_id: character.campaign_id, archived: character.archived, level: character.level,
    choices: character.choices, state, base_stats: character.base_stats,
    action_revision: typeof revision === "number" && Number.isSafeInteger(revision) ? String(revision) : revision });
}
