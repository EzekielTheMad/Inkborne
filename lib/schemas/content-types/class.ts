import { z } from "zod";
import { statConditionSchema } from "@/lib/schemas/effects";
import { SPELLCASTING_TYPES } from "@/lib/types/taxonomies";

const spellcastingConfigSchema = z.object({
  ability: z.string().min(1),
  type: z.enum(SPELLCASTING_TYPES),
  focus: z.string().default(""),
  ritual_casting: z.boolean().default(false),
});

const levelSpellcastingSchema = z.object({
  cantrips_known: z.number().int().min(0).optional(),
  spell_slots: z.array(z.number().int().min(0)).length(9),
});

const classLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(z.string()),
  spellcasting: levelSpellcastingSchema.nullable().default(null),
  subclass_level: z.boolean().optional(),
  class_specific: z.record(z.string(), z.unknown()).optional(),
});

const multiclassSchema = z.object({
  prerequisites: z.array(statConditionSchema),
  proficiencies_gained: z.array(z.string()),
});

import {
  sourceRefsSchema,
  spellcastingKnownSchema,
  spellcastingListSchema,
  spellcastingExtraSchema,
} from "./mechanical";

export const classDataSchema = z.object({
  hit_die: z.number().int().positive(),
  spellcasting: spellcastingConfigSchema.nullable(),
  multiclass: multiclassSchema,
  saving_throws: z.array(z.string()),
  starting_proficiencies: z.array(z.string()),
  levels: z.array(classLevelSchema).min(1),
  // Phase 1 mechanical fields
  attacks: z.array(z.number().int().positive()).length(20).optional(),
  improvements: z.array(z.boolean()).length(20).optional(),
  source_refs: sourceRefsSchema,
  // Phase 2 spellcasting fields
  spellcastingKnown: spellcastingKnownSchema.optional(),
  spellcastingList: spellcastingListSchema.optional(),
  spellcastingExtra: spellcastingExtraSchema.optional(),
  abilitySave: z.string().optional(),
});
export type ClassData = z.infer<typeof classDataSchema>;
