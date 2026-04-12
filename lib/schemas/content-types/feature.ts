import { z } from "zod";
import {
  ACTION_TYPES,
  RECOVERY_TYPES,
  abilityScoreArraySchema,
  visionEntrySchema,
  speedSchema,
  savetxtSchema,
  sourceRefsSchema,
  spellcastingBonusSchema,
  spellcastingExtraSchema,
} from "./mechanical";

export const FEATURE_TYPES = [
  "passive",         // Default — description only, no interaction needed
  "asi",             // Ability Score Improvement — show ASI/Feat selector
  "subclass",        // Subclass selection point — show subclass dropdown
  "fighting_style",  // Choose a fighting style
  "choice",          // Generic choice — has choice effects to resolve
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];

export const featureDataSchema = z.object({
  class: z.string().min(1),
  subclass: z.string().nullable().default(null),
  level: z.number().int().min(1).max(20),
  description: z.string().min(1),
  feature_type: z.enum(FEATURE_TYPES).default("passive"),
  // Phase 1 mechanical fields
  action: z.enum(ACTION_TYPES).nullable().default(null),
  usages: z.union([z.number(), z.array(z.number().nullable()).length(20)]).optional(),
  recovery: z.enum(RECOVERY_TYPES).nullable().default(null),
  additional: z.array(z.string().nullable()).length(20).optional(),
  scores: abilityScoreArraySchema.optional(),
  scoresMaximum: abilityScoreArraySchema.optional(),
  vision: z.array(visionEntrySchema).default([]),
  speed: speedSchema.optional(),
  dmgres: z.array(z.string()).default([]),
  savetxt: savetxtSchema.optional(),
  extraAC: z.number().optional(),
  extraLimitedFeatures: z.array(
    z.object({
      name: z.string(),
      usages: z.number(),
      recovery: z.enum(RECOVERY_TYPES),
    })
  ).default([]),
  source_refs: sourceRefsSchema,
  // Phase 2 spellcasting fields
  spellcastingBonus: z.array(spellcastingBonusSchema).default([]),
  spellcastingAbility: z.string().optional(),
  spellcastingExtra: spellcastingExtraSchema.optional(),
  fixedDC: z.number().int().positive().optional(),
  fixedSpAttack: z.number().int().optional(),
});
export type FeatureData = z.infer<typeof featureDataSchema>;
