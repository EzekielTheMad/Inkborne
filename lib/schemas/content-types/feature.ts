import { z } from "zod";

export const featureDataSchema = z.object({
  class: z.string().min(1),
  subclass: z.string().nullable().default(null),
  level: z.number().int().min(1).max(20),
  description: z.string().min(1),
});
export type FeatureData = z.infer<typeof featureDataSchema>;
