import { resolveEffectiveCastingSources } from "./effective-sources";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { AbilityScoreDefinition } from "@/lib/types/system";
import type { CharacterSpell } from "@/lib/types/spells";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { resolveCastingMath } from "./casting-math";

/** Mathematical inputs only. The provider resolves acquisition/pin authority. */
export interface ResolvedCastingProfile {
  classSlug: string;
  ability: string;
  abilityModifier: number;
  spellAttackBonus: number;
  spellDc: number;
}
export type CastingAbilityResolution =
  | { status: "available"; spell: CharacterSpell; profile: ResolvedCastingProfile; classPin: { contentId: string; version: number }; subclassPin?: { contentId: string; version: number } }
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
  const sources = resolveEffectiveCastingSources(classes, input.contentRefs, input.character);
  if (sources.status !== "available") return unavailable("exact selected casting profile is missing or invalid");
  const source = sources.sources.find(entry => entry.classSlug === spell.class_slug);
  if (!source?.active || !source.config) return unavailable("selected class cannot cast at this level");
  const ability = source.config.ability;
  const math = resolveCastingMath(ability, input.abilities, input.abilityScores, input.proficiencyBonus);
  if (math.status !== "available") return unavailable(math.reason);
  return { status: "available", spell, profile: { classSlug: spell.class_slug, ability, abilityModifier: math.abilityModifier, spellAttackBonus: math.spellAttackBonus, spellDc: math.spellDc }, classPin: source.parentPin, ...(source.subclassPin ? { subclassPin: source.subclassPin } : {}) };
}
