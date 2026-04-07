import { z } from "zod";

const subclassLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(z.string()),
});

export const subclassDataSchema = z.object({
  parent_class: z.string().min(1),
  flavor_label: z.string().default(""),
  description: z.string().default(""),
  levels: z.array(subclassLevelSchema).min(1),
  spells: z.array(z.string()).default([]),
});
export type SubclassData = z.infer<typeof subclassDataSchema>;
