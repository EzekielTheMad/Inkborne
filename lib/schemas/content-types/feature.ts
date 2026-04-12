import { z } from "zod";

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
});
export type FeatureData = z.infer<typeof featureDataSchema>;
