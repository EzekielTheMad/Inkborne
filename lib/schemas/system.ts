import { z } from "zod";

const abilityScoreDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  abbr: z.string().min(1).max(5),
});

const proficiencyLevelSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  multiplier: z.number(),
});

const derivedStatDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  formula: z.string().optional(),
  base: z.number().optional(),
  note: z.string().optional(),
});

const skillDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  ability: z.string().min(1),
});

const resourceDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["current_max_temp", "pool", "slots_by_level", "success_fail"]),
  per: z.string().optional(),
  levels: z.array(z.number()).optional(),
  max_each: z.number().optional(),
});

const contentTypeDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  plural: z.string().optional(),
  required: z.boolean().optional(),
  max: z.number().nullable().optional(),
  parent: z.string().optional(),
});

const currencyDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  rate: z.number().positive(),
});

const creationStepSchema = z.object({
  step: z.number().int().positive(),
  type: z.string().min(1),
  label: z.string().min(1),
  methods: z.array(z.string()).optional(),
  fields: z.array(z.string()).optional(),
});

const sheetSectionSchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  contains: z.array(z.string()).optional(),
  tab: z.boolean().optional(),
  extension_zone: z.boolean().optional(),
});

export const systemSchemaDefinitionSchema = z.object({
  ability_scores: z.array(abilityScoreDefSchema).min(1),
  proficiency_levels: z.array(proficiencyLevelSchema).min(1),
  derived_stats: z.array(derivedStatDefSchema),
  skills: z.array(skillDefSchema),
  resources: z.array(resourceDefSchema),
  content_types: z.array(contentTypeDefSchema).min(1),
  currencies: z.array(currencyDefSchema),
  creation_steps: z.array(creationStepSchema).min(1),
  sheet_sections: z.array(sheetSectionSchema).min(1),
});
