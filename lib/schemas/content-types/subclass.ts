import { z } from "zod";
import { SPELLCASTING_TYPES } from "@/lib/types/taxonomies";
import { spellcastingListSchema } from "./mechanical";

const nonblankSlug = z.string().refine(value => value.trim().length > 0, "Expected a nonblank slug");
// Add the shipped immutable tier-object form without changing class grants.
export const subclassSpellcastingExtraSchema = z.array(z.union([
  nonblankSlug,
  z.array(nonblankSlug),
  z.object({ level: z.number().int().min(1).max(20), spells: z.array(nonblankSlug) }),
]));
const subclassCastingConfigSchema = z.object({
  ability: nonblankSlug,
  type: z.enum(SPELLCASTING_TYPES),
  focus: z.string(),
  ritual_casting: z.boolean(),
});
const subclassKnownSchema = z.object({
  cantrips: z.array(z.number().int().nonnegative()).length(20),
  spells: z.union([z.array(z.number().int().nonnegative()).length(20), z.literal("all")]),
  prepared: z.boolean(),
});
const subclassCastingRowSchema = z.object({
  cantrips_known: z.number().int().nonnegative().optional(),
  spell_slots: z.array(z.number().int().nonnegative()).length(9),
});

const subclassLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  features: z.array(z.string()),
  // Absence is unknown for a declared casting profile, never default inactivity.
  spellcasting: subclassCastingRowSchema.nullable().optional(),
});

export const subclassDataSchema = z.object({
  parent_class: z.string().min(1),
  flavor_label: z.string().default(""),
  description: z.string().default(""),
  levels: z.array(subclassLevelSchema).min(1),
  spells: z.array(z.string()).default([]),
  spellcasting: subclassCastingConfigSchema.nullable().optional(),
  spellcastingKnown: subclassKnownSchema.optional(),
  spellcastingList: spellcastingListSchema.optional(),
  spellcastingExtra: subclassSpellcastingExtraSchema.optional(),
  preparation_rule: z.enum(["class-level-plus-ability", "half-class-level-plus-ability"]).optional(),
});
export type SubclassData = z.infer<typeof subclassDataSchema>;
