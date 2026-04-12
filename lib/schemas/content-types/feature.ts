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
  calcChangesSchema,
  addModSchema,
  languageProfsSchema,
} from "./mechanical";

// Structured choice definition for multi-selection features
const featureChoiceSchema = z.object({
  name: z.string().min(1),               // choice group name
  count: z.number().int().positive(),    // how many to pick
  options: z.array(z.string().min(1)),   // available option slugs
  prereq: z.string().optional(),         // prerequisite description
});

// Dynamic weapon creation from a feature
const weaponOptionSchema = z.object({
  name: z.string().min(1),
  baseWeapon: z.string().optional(),      // parent weapon slug for inheritance
  damage: z.object({
    dice: z.string().min(1),
    type: z.string().min(1),
  }).optional(),
  range: z.object({
    normal: z.number().positive(),
    long: z.number().positive().optional(),
  }).optional(),
  ability: z.number().int().min(0).max(6).optional(),
  description: z.string().default(""),
});

// Dynamic armor creation from a feature
const armorOptionSchema = z.object({
  name: z.string().min(1),
  ac: z.number().int().nonnegative(),
  dex_bonus: z.boolean().default(false),
  max_bonus: z.number().int().nullable().default(null),
  description: z.string().default(""),
});

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
  // Phase 3 mechanical fields
  calcChanges: calcChangesSchema,
  addMod: addModSchema,
  languageProfs: languageProfsSchema,
  carryingCapacity: z.number().optional(),
  prereqeval: z.string().optional(),
  choices: z.array(featureChoiceSchema).default([]),
  extrachoices: z.array(featureChoiceSchema).default([]),
  weaponOptions: z.array(weaponOptionSchema).default([]),
  armorOptions: z.array(armorOptionSchema).default([]),
});
export type FeatureData = z.infer<typeof featureDataSchema>;
