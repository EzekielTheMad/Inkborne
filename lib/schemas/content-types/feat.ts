import { z } from "zod";
import { statConditionSchema } from "@/lib/schemas/effects";

export const featDataSchema = z.object({
  description: z.string().min(1),
  prerequisites: z.array(statConditionSchema).default([]),
});
export type FeatData = z.infer<typeof featDataSchema>;
