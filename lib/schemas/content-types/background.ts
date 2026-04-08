import { z } from "zod";

const idealSchema = z.object({
  text: z.string().min(1),
  alignment: z.string().default(""),
});

export const backgroundDataSchema = z.object({
  feature: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
  personality_traits: z.array(z.string()).default([]),
  ideals: z.array(idealSchema).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
});
export type BackgroundData = z.infer<typeof backgroundDataSchema>;
