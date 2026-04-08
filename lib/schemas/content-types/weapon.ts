import { z } from "zod";
import { WEAPON_CATEGORIES, WEAPON_RANGE_TYPES, DAMAGE_TYPES } from "@/lib/types/taxonomies";

const costSchema = z.object({ quantity: z.number().min(0), unit: z.string().min(1) });
const weaponDamageSchema = z.object({ dice: z.string().min(1), type: z.enum(DAMAGE_TYPES) });
const rangeSchema = z.object({ normal: z.number().positive(), long: z.number().positive().optional() });

export const weaponDataSchema = z.object({
  weapon_category: z.enum(WEAPON_CATEGORIES),
  weapon_range: z.enum(WEAPON_RANGE_TYPES),
  cost: costSchema.nullable().default(null),
  weight: z.number().min(0).nullable().default(null),
  damage: weaponDamageSchema.nullable().default(null),
  range: rangeSchema.nullable().default(null),
  properties: z.array(z.string()).default([]),
  two_handed_damage: weaponDamageSchema.nullable().default(null),
});
export type WeaponData = z.infer<typeof weaponDataSchema>;
