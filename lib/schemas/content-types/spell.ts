import { z } from "zod";
import { MAGIC_SCHOOLS, DAMAGE_TYPES } from "@/lib/types/taxonomies";

const spellDamageSchema = z.object({
  type: z.enum(DAMAGE_TYPES),
  dice_at_slot_level: z.record(z.string(), z.string()),
});

const spellDcSchema = z.object({
  type: z.string().min(1),
  success: z.enum(["half", "none", "other"]),
});

const areaOfEffectSchema = z.object({
  type: z.enum(["sphere", "cone", "cylinder", "line", "cube"]),
  size: z.number().positive(),
});

export const spellDataSchema = z.object({
  level: z.number().int().min(0).max(9),
  school: z.enum(MAGIC_SCHOOLS),
  casting_time: z.string().min(1),
  range: z.string().min(1),
  components: z.array(z.enum(["V", "S", "M"])),
  material: z.string().optional(),
  duration: z.string().min(1),
  concentration: z.boolean(),
  ritual: z.boolean(),
  description: z.string().min(1),
  higher_level: z.string().optional(),
  damage: spellDamageSchema.nullable().default(null),
  heal_at_slot_level: z.record(z.string(), z.string()).nullable().optional().default(null),
  dc: spellDcSchema.nullable().default(null),
  area_of_effect: areaOfEffectSchema.nullable().default(null),
  classes: z.array(z.string()).default([]),
  subclasses: z.array(z.string()).default([]),
});
export type SpellData = z.infer<typeof spellDataSchema>;
