import { z } from "zod";
import { CREATURE_SIZES } from "@/lib/types/taxonomies";
import {
  abilityScoreArraySchema,
  speedSchema,
  visionEntrySchema,
  savetxtSchema,
  sourceRefsSchema,
} from "./mechanical";

export const raceDataSchema = z.object({
  size: z.enum(CREATURE_SIZES),
  speed: z.number().int().positive(),
  age_description: z.string().optional().default(""),
  alignment_description: z.string().optional().default(""),
  size_description: z.string().optional().default(""),
  language_description: z.string().optional().default(""),
  traits: z.array(z.string()).default([]),
  subraces: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  // Phase 1 mechanical fields
  scores: abilityScoreArraySchema.optional(),
  scorestxt: z.string().optional(),
  speed_detail: speedSchema.optional(),
  vision: z.array(visionEntrySchema).default([]),
  dmgres: z.array(z.string()).default([]),
  savetxt: savetxtSchema.optional(),
  skills: z.array(z.string()).default([]),
  skillstxt: z.string().optional(),
  weaponProfs: z.array(z.string()).default([]),
  armorProfs: z.array(z.string()).default([]),
  toolProfs: z.array(z.string()).default([]),
  source_refs: sourceRefsSchema,
});
export type RaceData = z.infer<typeof raceDataSchema>;
