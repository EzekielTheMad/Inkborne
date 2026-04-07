import { z } from "zod";

const costSchema = z.object({ quantity: z.number().min(0), unit: z.string().min(1) });

export const itemDataSchema = z.object({
  equipment_category: z.string().default(""),
  cost: costSchema.nullable().default(null),
  weight: z.number().min(0).nullable().default(null),
  description: z.string().default(""),
});
export type ItemData = z.infer<typeof itemDataSchema>;
