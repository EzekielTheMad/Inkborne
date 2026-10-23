import { z } from "zod";

// Catalog schemas must remain runtime-neutral: importing a builder/character
// reader here would cycle back through the canonical content-type registry.
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(300);
export const bonusSpellPinSchema = z.strictObject({
  content_id: z.string().uuid(), content_version: z.number().int().positive(),
});
export type BonusSpellPin = z.infer<typeof bonusSpellPinSchema>;

/** Source-owned acquisition policy, separate from gameplay resource spending. */
export const bonusSpellChoiceSchema = z.strictObject({
  choice_id: slug,
  choose: z.number().int().min(1).max(3),
  min_spell_level: z.number().int().min(0).max(9),
  max_spell_level: z.union([z.number().int().min(0).max(9), z.literal("class")]),
  list_class: slug.nullable(),
  ritual_only: z.boolean(),
  spellbook_only: z.boolean(),
  counts_known: z.boolean(),
  always_prepared: z.boolean(),
  mode: z.enum(["known", "ritual", "arcanum", "mastery", "signature"]),
}).refine(value => value.max_spell_level === "class" || value.max_spell_level >= value.min_spell_level,
  { message: "Bonus spell levels must be ordered" });
export type BonusSpellChoice = z.infer<typeof bonusSpellChoiceSchema>;

export const bonusSpellGrantSchema = z.strictObject({
  class_level: z.number().int().min(1).max(20),
  spells: z.array(slug).min(1).max(10).refine(values => new Set(values).size === values.length),
  always_prepared: z.literal(true),
});
export type BonusSpellGrant = z.infer<typeof bonusSpellGrantSchema>;

export const bonusSpellChoicesSchema = z.array(bonusSpellChoiceSchema).max(8)
  .refine(values => new Set(values.map(value => value.choice_id)).size === values.length);
