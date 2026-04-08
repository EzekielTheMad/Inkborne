import { z } from "zod";

export const subraceDataSchema = z.object({
  parent_race: z.string().min(1),
  description: z.string().default(""),
  traits: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
});
export type SubraceData = z.infer<typeof subraceDataSchema>;
