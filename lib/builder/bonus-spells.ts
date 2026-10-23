import { z } from "zod";
import type { CharacterChoices } from "@/lib/types/character";
import type { ChoiceEffect } from "@/lib/types/effects";
import { expertiseProficiencies, type ExpertiseSource } from "./expertise";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(300);
export const bonusSpellPinSchema = z.strictObject({
  content_id: z.string().uuid(), content_version: z.number().int().positive(),
});
export type BonusSpellPin = z.infer<typeof bonusSpellPinSchema>;

/** Source-owned builder selection policy. These describe acquisition only;
 * resource spending and free casts remain separate gameplay commands. */
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

const bonusSpellChoicesSchema = z.array(bonusSpellChoiceSchema).max(8)
  .refine(values => new Set(values.map(value => value.choice_id)).size === values.length);
export function readBonusSpellChoices(data: unknown): BonusSpellChoice[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const result = bonusSpellChoicesSchema.safeParse((data as Record<string, unknown>).bonus_spells);
  return result.success ? result.data : [];
}

export interface BonusSpellCandidate {
  id: string;
  version: number;
  data: Record<string, unknown>;
}
export interface BonusSpellEligibilityContext {
  /** This class's own learnable level, never the combined multiclass slots. */
  classMaxSpellLevel: number;
  spellbook?: readonly BonusSpellPin[];
}

export function isBonusSpellEligible(choice: BonusSpellChoice, spell: BonusSpellCandidate,
  context: BonusSpellEligibilityContext): boolean {
  if (!bonusSpellChoiceSchema.safeParse(choice).success
    || !bonusSpellPinSchema.safeParse({ content_id: spell.id, content_version: spell.version }).success) return false;
  const level = spell.data.level;
  const max = choice.max_spell_level === "class" ? context.classMaxSpellLevel : choice.max_spell_level;
  if (!Number.isInteger(max) || max < 0 || max > 9 || !Number.isInteger(level)
    || (level as number) < choice.min_spell_level || (level as number) > max) return false;
  if (!Array.isArray(spell.data.classes) || spell.data.classes.length === 0
    || !spell.data.classes.every(value => typeof value === "string")
    || (choice.list_class !== null && !spell.data.classes.includes(choice.list_class))) return false;
  if (choice.ritual_only && spell.data.ritual !== true) return false;
  if (choice.spellbook_only && !context.spellbook?.some(pin =>
    pin.content_id === spell.id && pin.content_version === spell.version)) return false;
  return true;
}

/** Feature reservations apply even before the choices are filled. Magical
 * Secrets cantrips spend the Secrets known allowance, not Bard cantrip slots. */
export function ordinaryKnownSpellBudget(base: number, activeChoices: readonly BonusSpellChoice[]): number {
  if (!Number.isInteger(base) || base < 0 || activeChoices.some(choice => !bonusSpellChoiceSchema.safeParse(choice).success)
    || new Set(activeChoices.map(choice => choice.choice_id)).size !== activeChoices.length) return 0;
  return Math.max(0, base - activeChoices.reduce((sum, choice) => sum + (choice.counts_known ? choice.choose : 0), 0));
}

export function bonusSpellSelectionComplete(choice: BonusSpellChoice, selected: unknown,
  spells: readonly BonusSpellCandidate[], context: BonusSpellEligibilityContext): boolean {
  const pins = z.array(bonusSpellPinSchema).safeParse(selected);
  return pins.success && pins.data.length === choice.choose
    && new Set(pins.data.map(pin => pin.content_id)).size === pins.data.length
    && pins.data.every(pin => {
      const matches = spells.filter(spell => spell.id === pin.content_id && spell.version === pin.content_version);
      return matches.length === 1 && isBonusSpellEligible(choice, matches[0], context);
    });
}

/** Lore grants three new proficiencies; its own saved picks stay selectable
 * while class, race, background and other active sources reserve their skills. */
export function resolveLoreSkillChoice(choice: ChoiceEffect, refs: readonly ExpertiseSource[], choices: CharacterChoices): ChoiceEffect {
  if (choice.choice_id !== "bonus-proficiencies" || choice.grant_type !== "proficiency") return choice;
  const resolved = { ...choices.resolved_choices };
  delete resolved[choice.choice_id];
  const occupied = expertiseProficiencies(refs, { ...choices, resolved_choices: resolved });
  const definitions = refs.flatMap(ref => ref.content_definitions?.effects ?? [])
    .filter(effect => effect.type === "choice" && effect.choice_id === choice.choice_id);
  return { ...choice, from: Array.isArray(choice.from) && definitions.length === 1
    ? choice.from.filter(value => value.startsWith("skill-") && !occupied.has(value)) : [] };
}
