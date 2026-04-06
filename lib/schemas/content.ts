import { z } from "zod";
import { effectSchema, statConditionSchema } from "./effects";

export const contentDefinitionSchema = z.object({
  system_id: z.string().uuid(),
  content_type: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  effects: z.array(effectSchema).default([]),
  source: z.enum(["srd", "homebrew"]),
  scope: z.enum(["platform", "personal", "shared"]),
  owner_id: z.string().uuid().nullable(),
  version: z.number().int().positive().default(1),
});

export const customContentTypeSchema = z.object({
  system_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  allow_multiple: z.boolean().default(false),
  entry_conditions: z.array(statConditionSchema).default([]),
  has_progression: z.boolean().default(false),
  scope: z.enum(["personal", "shared"]),
  version: z.number().int().positive().default(1),
});
