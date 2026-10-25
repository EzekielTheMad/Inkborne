import { z } from "zod";

// Runtime-neutral finite acquisition policy. This declares no gameplay resource.
const rebuke = z.strictObject({ character_level: z.literal(3), spell: z.literal("hellish-rebuke"),
  spell_level: z.literal(1), cast_level: z.literal(2) });
const darkness = z.strictObject({ character_level: z.literal(5), spell: z.literal("darkness"),
  spell_level: z.literal(2), cast_level: z.literal(2) });
export const earnedRacialSpellsSchema = z.strictObject({ version: z.literal(1),
  source_trait: z.literal("infernal-legacy"), spellcasting_ability: z.literal("charisma"),
  grants: z.tuple([rebuke, darkness]) });
export type EarnedRacialSpells = z.infer<typeof earnedRacialSpellsSchema>;
export const INFERNAL_LEGACY_EARNED_SPELLS: EarnedRacialSpells = {
  version: 1, source_trait: "infernal-legacy", spellcasting_ability: "charisma",
  grants: [{ character_level: 3, spell: "hellish-rebuke", spell_level: 1, cast_level: 2 },
    { character_level: 5, spell: "darkness", spell_level: 2, cast_level: 2 }],
};
const earned = z.discriminatedUnion("grant_key", [
  z.strictObject({ contract_version: z.literal(1), grant_key: z.literal("infernal-legacy:3:hellish-rebuke"),
    character_level: z.literal(3), spell_level: z.literal(1), cast_level: z.literal(2) }),
  z.strictObject({ contract_version: z.literal(1), grant_key: z.literal("infernal-legacy:5:darkness"),
    character_level: z.literal(5), spell_level: z.literal(2), cast_level: z.literal(2) }),
]);
export const earnedRacialSpellSourceSchema = z.strictObject({ builder_source_pin_id: z.uuid(),
  builder_root_ref_id: z.uuid(), builder_choice_id: z.null(), spellcasting_ability: z.literal("charisma"),
  builder_earned_racial_spell: earned });
export type EarnedRacialSpellSource = z.infer<typeof earnedRacialSpellSourceSchema>;

const fixedLegacyGrant = z.strictObject({ type: z.literal("grant"),
  stat: z.enum(["spellcasting_ability", "spell"]), value: z.string().min(1) });

/** Check immutable raw declarations before the generic parser strips extensions.
 * A conditional grant cannot become an unconditional positive source.
 */
export function infernalLegacyDeclarationsSupported(type: unknown, slug: unknown, effects: unknown): boolean {
  if (type !== "trait" || slug !== "infernal-legacy") return true;
  return Array.isArray(effects) && effects.every(effect => {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) return true;
    if (effect.type === "grant" && ["spellcasting_ability", "spell"].includes(effect.stat)) {
      return fixedLegacyGrant.safeParse(effect).success;
    }
    return true;
  });
}

/** A claim is not positive evidence. Malformed claims also cannot use slots. */
export function hasEarnedRacialSpellClaim(spell: { source?: string; custom_data?: unknown }): boolean {
  return !!spell.custom_data && typeof spell.custom_data === "object"
    && Object.hasOwn(spell.custom_data, "builder_earned_racial_spell");
}
