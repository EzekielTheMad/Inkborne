import { z } from "zod";

export const languageDataSchema = z.object({
  type: z.enum(["Standard", "Exotic"]).default("Standard"),
  script: z.string().nullable().default(null),
  typical_speakers: z.array(z.string()).default([]),
  description: z.string().default(""),
});
export type LanguageData = z.infer<typeof languageDataSchema>;
