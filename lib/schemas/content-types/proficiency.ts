import { z } from "zod";
import { PROFICIENCY_TYPES } from "@/lib/types/taxonomies";

export const proficiencyDataSchema = z.object({
  proficiency_type: z.enum(PROFICIENCY_TYPES),
  reference: z.string().default(""),
  classes: z.array(z.string()).default([]),
  races: z.array(z.string()).default([]),
});
export type ProficiencyData = z.infer<typeof proficiencyDataSchema>;
