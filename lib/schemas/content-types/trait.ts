import { z } from "zod";
import { RECOVERY_TYPES } from "./mechanical";

export const traitDataSchema = z.object({
  description: z.string().min(1),
  races: z.array(z.string()).default([]),
  subraces: z.array(z.string()).default([]),
  // Limited-use tracking (consumed by Feature Resources system).
  // Most racial traits are passive (no usages, no recovery) — these fields
  // are optional and default to "non-resource".
  usages: z.union([z.number(), z.array(z.number().nullable()).length(20)]).optional(),
  recovery: z.enum(RECOVERY_TYPES).nullable().default(null),
  extraLimitedFeatures: z.array(
    z.object({
      name: z.string(),
      usages: z.number(),
      recovery: z.enum(RECOVERY_TYPES),
    })
  ).default([]),
});
export type TraitData = z.infer<typeof traitDataSchema>;
