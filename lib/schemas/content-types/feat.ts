import { z } from "zod";
import { statConditionSchema } from "@/lib/schemas/effects";
import {
  abilityScoreArraySchema,
  speedSchema,
  visionEntrySchema,
  savetxtSchema,
  ACTION_TYPES,
  RECOVERY_TYPES,
  sourceRefsSchema,
  spellcastingBonusSchema,
  languageProfsSchema,
  toolProfsSchema,
  skillProfsSchema,
  calcChangesSchema,
  addModSchema,
} from "./mechanical";

export const featDataSchema = z.object({
  description: z.string().min(1),
  prerequisites: z.array(statConditionSchema).default([]),
  // Phase 3 mechanical fields
  scores: abilityScoreArraySchema.optional(),
  scoresMaximum: abilityScoreArraySchema.optional(),
  scorestxt: z.string().optional(),
  action: z.enum(ACTION_TYPES).nullable().default(null),
  usages: z.union([z.number(), z.array(z.number().nullable()).length(20)]).optional(),
  recovery: z.enum(RECOVERY_TYPES).nullable().default(null),
  speed: speedSchema.optional(),
  vision: z.array(visionEntrySchema).default([]),
  dmgres: z.array(z.string()).default([]),
  savetxt: savetxtSchema.optional(),
  skills: skillProfsSchema,
  skillstxt: z.string().optional(),
  weaponProfs: z.array(z.string()).default([]),
  armorProfs: z.array(z.string()).default([]),
  toolProfs: toolProfsSchema,
  languageProfs: languageProfsSchema,
  extraAC: z.number().optional(),
  spellcastingBonus: z.array(spellcastingBonusSchema).default([]),
  spellcastingAbility: z.string().optional(),
  extraLimitedFeatures: z.array(
    z.object({
      name: z.string(),
      usages: z.number(),
      recovery: z.enum(RECOVERY_TYPES),
    })
  ).default([]),
  calcChanges: calcChangesSchema,
  addMod: addModSchema,
  source_refs: sourceRefsSchema,
});
export type FeatData = z.infer<typeof featDataSchema>;
