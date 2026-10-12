import type { CharacterWithSystem } from "@/lib/types/character";
import type { AbilityScoreDefinition } from "@/lib/types/system";
import type { CharacterSpell } from "@/lib/types/spells";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { computeSpellAttackBonus, computeSpellDc, resolvePinnedSpellSlots } from "./helpers";

/** Mathematical inputs only. The provider resolves acquisition/pin authority. */
export interface ResolvedCastingProfile {
  classSlug: string;
  ability: string;
  abilityModifier: number;
  spellAttackBonus: number;
  spellDc: number;
}
export type CastingAbilityResolution =
  | { status: "available"; spell: CharacterSpell; profile: ResolvedCastingProfile; classPin: { contentId: string; version: number } }
  | { status: "unavailable"; reason: string };

export interface CastingAbilityInput {
  character: Pick<CharacterWithSystem, "id" | "system_id" | "choices">;
  spells: readonly CharacterSpell[];
  contentRefs: ContentRefWithContent[];
  abilities: readonly Pick<AbilityScoreDefinition, "slug">[];
  abilityScores: Record<string, number>;
  proficiencyBonus: unknown;
}

/** Resolve only a current loaded acquisition and its exact selected class pin.
 * A caller's same-identity copy cannot replace the loaded snapshot/effects. */
export function resolveCastingAbility(target: CharacterSpell, input: CastingAbilityInput): CastingAbilityResolution {
  const unavailable = (detail: string): CastingAbilityResolution => ({ status: "unavailable", reason: `The saved casting source is unavailable: ${detail}. Reload the character or restore its saved spell/class content before casting.` });
  if (!target || typeof target.id !== "string" || !target.id) return unavailable("missing acquisition identity");
  const rows = input.spells.filter(row => row?.id === target.id);
  if (rows.length !== 1) return unavailable("missing or ambiguous spell acquisition");
  const spell = rows[0];
  if (["character_id", "content_id", "content_version", "class_slug"].some(key =>
    spell[key as keyof CharacterSpell] !== target[key as keyof CharacterSpell]) || spell.character_id !== input.character.id) {
    return unavailable("spell acquisition identity changed");
  }
  const definition = spell.content_definitions;
  if (!definition || !spell.content_id || !Number.isInteger(spell.content_version) || (spell.content_version ?? 0) < 1 ||
    definition.id !== spell.content_id || definition.version !== spell.content_version ||
    definition.system_id !== input.character.system_id || definition.content_type !== "spell" ||
    typeof definition.data?.level !== "number" || !Number.isInteger(definition.data.level) || definition.data.level < 0 || definition.data.level > 9) {
    return unavailable("exact spell snapshot is missing or mismatched");
  }
  const classes = input.character.choices?.classes;
  if (!Array.isArray(classes) || typeof spell.class_slug !== "string" || !spell.class_slug) return unavailable("missing acquisition class");
  const choices = classes.filter(choice => choice?.slug === spell.class_slug);
  if (choices.length !== 1) return unavailable("acquisition class is not uniquely selected");
  // Reuse exact-pin/profile/numbered-row validation; do not infer casting unlocks.
  if (resolvePinnedSpellSlots(choices, input.contentRefs, input.character).status !== "available") return unavailable("exact selected class profile is missing or invalid");
  const ref = input.contentRefs.find(row => row.content_definitions?.content_type === "class" && row.content_definitions.slug === spell.class_slug)!;
  const data = ref.content_definitions.data as { spellcasting: { ability: string } | null; levels: Array<{ level: number; spellcasting: unknown }> };
  if (data.levels.find(row => row.level === choices[0].level)?.spellcasting === null || !data.spellcasting) return unavailable("selected class cannot cast at this level");
  const ability = data.spellcasting.ability;
  if (input.abilities.filter(entry => entry.slug === ability).length !== 1) return unavailable("casting ability is not uniquely defined by this system");
  const score = input.abilityScores[ability];
  if (typeof score !== "number" || !Number.isFinite(score) || typeof input.proficiencyBonus !== "number" || !Number.isFinite(input.proficiencyBonus)) return unavailable("evaluated casting values are missing or invalid");
  const abilityModifier = Math.floor((score - 10) / 2);
  const spellAttackBonus = computeSpellAttackBonus({ ability }, input.abilityScores, input.proficiencyBonus);
  const spellDc = computeSpellDc({ ability }, input.abilityScores, input.proficiencyBonus);
  if (![abilityModifier, spellAttackBonus, spellDc].every(Number.isFinite)) return unavailable("evaluated casting values overflow");
  return { status: "available", spell, profile: { classSlug: spell.class_slug, ability, abilityModifier, spellAttackBonus, spellDc }, classPin: { contentId: ref.content_id, version: ref.content_version } };
}
