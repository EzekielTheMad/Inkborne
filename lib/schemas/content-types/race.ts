import { z } from "zod";
import { CREATURE_SIZES } from "@/lib/types/taxonomies";

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
});
export type RaceData = z.infer<typeof raceDataSchema>;
