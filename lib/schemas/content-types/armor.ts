import { z } from "zod";
import { ARMOR_CATEGORIES } from "@/lib/types/taxonomies";

const costSchema = z.object({ quantity: z.number().min(0), unit: z.string().min(1) });
const armorClassSchema = z.object({
  base: z.number().int(),
  dex_bonus: z.boolean(),
  max_bonus: z.number().int().nullable().default(null),
});

export const armorDataSchema = z.object({
  armor_category: z.enum(ARMOR_CATEGORIES),
  cost: costSchema.nullable().default(null),
  weight: z.number().min(0).nullable().default(null),
  armor_class: armorClassSchema,
  str_minimum: z.number().int().min(0).default(0),
  stealth_disadvantage: z.boolean().default(false),
});
export type ArmorData = z.infer<typeof armorDataSchema>;
