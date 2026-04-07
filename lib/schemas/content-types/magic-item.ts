import { z } from "zod";
import { ITEM_RARITIES } from "@/lib/types/taxonomies";

export const magicItemDataSchema = z.object({
  rarity: z.enum(ITEM_RARITIES).default("Common"),
  description: z.string().default(""),
  equipment_category: z.string().optional(),
});
export type MagicItemData = z.infer<typeof magicItemDataSchema>;
