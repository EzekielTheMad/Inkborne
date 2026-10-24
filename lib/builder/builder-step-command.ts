import { z } from "zod";
import type { CharacterChoices } from "@/lib/types/character";
import { equipmentSelectionsSchema } from "./starting-equipment-contract";
import { boundedClassRoleJson, classRoleRevisionSchema } from "@/lib/character/class-role-effects-schema";
import { equalEquipmentIntent } from "./starting-equipment-contract";

const content = z.strictObject({ content_id: z.uuid(), content_version: z.number().int().positive() });
const choice = z.strictObject({ choice_id: z.string().min(1).max(200),
  selections: z.array(z.string().min(1).max(300)).max(100) });
const method = z.enum(["standard_array", "point_buy", "manual"]);
const scores = z.partialRecord(z.enum(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]), z.number().int().min(1).max(30));
const hpRoll = z.strictObject({ method: z.enum(["average", "manual", "rolled"]), value: z.number().int().min(1).max(100).nullable() });
const asi = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("asi"), allocations: z.array(z.strictObject({
    ability: z.enum(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]), amount: z.number().int().min(1).max(2),
  })).min(1).max(2) }),
  z.strictObject({ mode: z.literal("feat"), feat_id: z.uuid(), feat_version: z.number().int().positive() }),
]);
export const builderStepInputSchema = z.discriminatedUnion("command", [
  z.strictObject({ command: z.literal("favored_enemy"), fields: z.strictObject({ feature_slug: z.string().min(1).max(200),
    selection: z.discriminatedUnion("mode", [
      z.strictObject({ mode: z.literal("type"), enemy_type: z.string().regex(/^[a-z][a-z-]*$/).max(100) }),
      z.strictObject({ mode: z.literal("humanoids"), races: z.array(z.string().regex(/^[a-z][a-z-]*$/).max(100)).length(2)
        .refine(values => new Set(values).size === 2) }),
    ]), language: z.string().regex(/^[a-z][a-z-]*$/).max(100).nullable() }) }),
  z.strictObject({ command: z.literal("add_class"), fields: z.strictObject({ class_id: z.uuid(),
    class_version: z.number().int().positive(), expected_action_revision: classRoleRevisionSchema }) }),
  z.strictObject({ command: z.literal("remove_class"), fields: z.strictObject({ occurrence_id: z.uuid(),
    expected_action_revision: classRoleRevisionSchema }) }),
  z.strictObject({ command: z.enum(["select_race", "select_subrace", "select_background"]), fields: content }),
  z.strictObject({ command: z.enum(["clear_race", "clear_subrace"]), fields: z.strictObject({}) }),
  z.strictObject({ command: z.enum(["race_choice", "background_choice", "class_choice"]), fields: choice }),
  z.strictObject({ command: z.literal("fighting_style"), fields: z.strictObject({
    feature_slug: z.string().min(1).max(200), style_slug: z.string().min(1).max(200).nullable(),
  }) }),
  z.strictObject({ command: z.literal("select_subclass"), fields: z.strictObject({
    class_slug: z.string().min(1).max(200), content_id: z.uuid().nullable(), content_version: z.number().int().positive().nullable(),
  }).refine(fields => (fields.content_id === null) === (fields.content_version === null)) }),
  z.strictObject({ command: z.literal("save_details"), fields: z.strictObject({
    name: z.string().trim().min(1).max(100), alignment: z.string().trim().min(1).max(100).nullable(),
  }) }),
  z.strictObject({ command: z.literal("set_class_level"), fields: z.strictObject({
    class_slug: z.string().min(1).max(200), level: z.number().int().min(1).max(20), hp_roll: hpRoll.nullable().optional(),
  }) }),
  z.strictObject({ command: z.literal("save_hp_roll"), fields: z.strictObject({
    class_slug: z.string().min(1).max(200), level: z.number().int().min(1).max(20), ...hpRoll.shape,
  }) }),
  z.strictObject({ command: z.literal("select_asi"), fields: z.strictObject({ feature_slug: z.string().min(1).max(200), choice: asi }) }),
  z.strictObject({ command: z.literal("select_class_spells"), fields: z.strictObject({
    class_slug: z.string().min(1).max(200), spells: z.array(z.strictObject({ content_id: z.uuid(),
      content_version: z.number().int().positive(), prepared: z.boolean() })).max(200),
  }) }),
  z.strictObject({ command: z.literal("select_bonus_spells"), fields: z.strictObject({
    feature_slug: z.string().regex(/^[a-z][a-z0-9-]*$/).max(200),
    choice_id: z.string().regex(/^[a-z][a-z0-9-]*$/).max(200),
    spells: z.array(content).max(3).refine(values => new Set(values.map(value => value.content_id)).size === values.length),
  }) }),
  z.strictObject({ command: z.literal("background_narrative"), fields: z.strictObject({
    key: z.enum(["personality_traits", "ideals", "bonds", "flaws"]),
    values: z.array(z.string().min(1).max(2000).refine(value => value.trim().length > 0)).max(20),
  }) }),
  z.strictObject({ command: z.literal("save_abilities"), fields: z.strictObject({
    method, scores, expected_method: method.nullable(), expected_scores: scores,
  }) }),
  z.strictObject({ command: z.literal("select_equipment"), fields: equipmentSelectionsSchema.omit({ confirmed: true }) }),
]);
export type BuilderStepCommand = z.infer<typeof builderStepInputSchema>["command"];
export type BuilderStepSaved = { choices: CharacterChoices; scores: Record<string, number>; action_revision: string };
export type SaveBuilderStep = (command: BuilderStepCommand, fields: Record<string, unknown>) => Promise<BuilderStepSaved>;

/** The complete original browser request, retained before any mutation is sent. */
export const builderStepIntentSchema = z.strictObject({
  contract_version: z.literal(1), operation_id: z.uuid(), character_id: z.uuid(),
  command: z.unknown(), fields: z.unknown(),
}).transform((value, context) => {
  const patch = builderStepInputSchema.safeParse({ command: value.command, fields: value.fields });
  if (!patch.success) {
    context.addIssue({ code: "custom", message: "Invalid builder selection" });
    return z.NEVER;
  }
  return { ...value, ...patch.data };
});
export type BuilderStepIntent = z.infer<typeof builderStepIntentSchema>;
export function parseBuilderStepIntent(value: unknown): BuilderStepIntent | null {
  if (!boundedClassRoleJson(value)) return null;
  const parsed = builderStepIntentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function sameBuilderStepIntent(left: BuilderStepIntent, right: BuilderStepIntent): boolean {
  return equalEquipmentIntent(left, right);
}

export const builderStepReceiptSchema = z.strictObject({
  operation_id: z.uuid(), character_id: z.uuid(), actor_id: z.uuid(), command: z.string(), fields: z.unknown(),
  saved_choices: z.record(z.string(), z.unknown()), saved_scores: z.record(z.string(), z.number()),
  action_revision: z.string().regex(/^(0|[1-9][0-9]*)$/),
});
export const builderStepResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.enum(["applied", "replayed", "recorded"]), receipt: builderStepReceiptSchema }),
  z.strictObject({ status: z.literal("absent") }),
]);
export type BuilderStepResponse = z.infer<typeof builderStepResponseSchema>;
