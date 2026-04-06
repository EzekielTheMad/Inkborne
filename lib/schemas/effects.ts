import { z } from "zod";

const conditionOpSchema = z.enum(["gte", "lte", "gt", "lt", "eq", "neq"]);

export const statConditionSchema = z.object({
  stat: z.string().min(1),
  op: conditionOpSchema,
  value: z.number(),
});

const effectOpSchema = z.enum(["add", "set", "multiply", "grant", "max", "min"]);

// In Zod v4, .refine() mutates the ZodObject in-place and returns the same instance,
// so the refined schema can be used directly in a discriminatedUnion.
export const mechanicalEffectSchema = z
  .object({
    type: z.literal("mechanical"),
    stat: z.string().min(1),
    op: z.union([effectOpSchema, z.literal("formula")]),
    value: z.union([z.number(), z.string()]).optional(),
    expr: z.string().optional(),
  })
  .refine(
    (e) => {
      if (e.op === "formula") return typeof e.expr === "string" && e.expr.length > 0;
      return e.value !== undefined;
    },
    { message: "Formula effects require 'expr'; other effects require 'value'" }
  );

export const narrativeEffectSchema = z.object({
  type: z.literal("narrative"),
  text: z.string().min(1),
  tag: z.string().optional(),
});

export const grantEffectSchema = z.object({
  type: z.literal("grant"),
  stat: z.string().min(1),
  value: z.string().min(1),
});

export const effectSchema = z.discriminatedUnion("type", [
  mechanicalEffectSchema,
  narrativeEffectSchema,
  grantEffectSchema,
]);

const progressionTriggerAutoSchema = z.object({
  type: z.literal("auto"),
  conditions: z.array(statConditionSchema).min(1),
});

const progressionTriggerManualSchema = z.object({
  type: z.literal("manual"),
  dm_only: z.boolean().optional(),
});

const progressionTriggerSchema = z.discriminatedUnion("type", [
  progressionTriggerAutoSchema,
  progressionTriggerManualSchema,
]);

export const progressionTierSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  trigger: progressionTriggerSchema,
  effects: z.array(effectSchema),
});

export const progressionTrackSchema = z.object({
  tiers: z.array(progressionTierSchema).min(1),
});
