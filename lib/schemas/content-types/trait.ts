import { z } from "zod";

export const traitDataSchema = z.object({
  description: z.string().min(1),
  races: z.array(z.string()).default([]),
  subraces: z.array(z.string()).default([]),
});
export type TraitData = z.infer<typeof traitDataSchema>;
