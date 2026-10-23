import { resolveEffectiveCastingSources } from "./effective-sources";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { AbilityScoreDefinition } from "@/lib/types/system";
import type { CharacterSpell } from "@/lib/types/spells";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { resolveCastingMath } from "./casting-math";
import { z } from "zod";

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
  | { status: "available"; spell: CharacterSpell; profile: ResolvedCastingProfile; racialPin: { contentId: string; version: number }; traitPin: { contentId: string; version: number } }
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
  if (spell.source === "racial_trait") {
    const source = z.strictObject({ builder_source_pin_id: z.uuid(), builder_root_ref_id: z.uuid(),
      builder_choice_id: z.string().min(1).nullable(), spellcasting_ability: z.string().min(1) }).safeParse(spell.custom_data);
    if (!source.success || definition.data.level !== 0) return unavailable("racial cantrip provenance is invalid");
    const exact = (pinId: string) => {
      const found = input.contentRefs.filter(ref => ref.id === pinId);
      const pin = found[0];
      return found.length === 1 && pin?.character_id === input.character.id && pin.content_id === pin.content_definitions.id
        && pin.content_version === pin.content_definitions.version && pin.content_version > 0
        && pin.content_definitions.system_id === input.character.system_id ? pin : null;
    };
    const root = exact(source.data.builder_root_ref_id), pin = exact(source.data.builder_source_pin_id);
    if (!root || !pin || !["race", "subrace"].includes(root.content_definitions.content_type)
      || input.character.choices[root.content_definitions.content_type as "race" | "subrace"] !== root.content_definitions.slug
      || spell.class_slug !== `race:${root.content_definitions.slug}`) return unavailable("racial source is not currently selected");
    if (root.content_definitions.content_type === "subrace" && (root.content_definitions.data.parent_race !== input.character.choices.race
      || input.contentRefs.filter(ref => ref.character_id === input.character.id && ref.content_definitions.content_type === "race"
        && ref.content_definitions.slug === input.character.choices.race && exact(ref.id)).length !== 1))
      return unavailable("subrace has no matching saved race");
    if (pin.id !== root.id && (pin.content_definitions.content_type !== "trait" || pin.context.source !== "racial_trait"
      || pin.context.root_controller_ref_id !== root.id || !Array.isArray(root.content_definitions.data.traits)
      || !root.content_definitions.data.traits.includes(pin.content_definitions.slug))) return unavailable("racial trait is not owned by its source");
    const effects = pin.content_definitions.effects;
    const abilities = effects.filter(effect => effect.type === "grant" && effect.stat === "spellcasting_ability");
    if (abilities.length !== 1 || abilities[0].type !== "grant" || abilities[0].value !== source.data.spellcasting_ability)
      return unavailable("racial casting ability is ambiguous or changed");
    const choiceId = source.data.builder_choice_id;
    const matching = effects.filter(effect => choiceId === null
      ? effect.type === "grant" && effect.stat === "spell" && effect.value === definition.slug
      : effect.type === "choice" && effect.choice_id === choiceId && effect.grant_type === "spell" && Array.isArray(effect.from) && effect.from.includes(definition.slug));
    if (matching.length !== 1 || choiceId !== null && !input.character.choices.resolved_choices?.[choiceId]?.includes(definition.slug))
      return unavailable("racial spell is not granted by its saved source");
    const ability = source.data.spellcasting_ability;
    const math = resolveCastingMath(ability, input.abilities, input.abilityScores, input.proficiencyBonus);
    if (math.status !== "available") return unavailable(math.reason);
    return { status: "available", spell, profile: { classSlug: spell.class_slug, ability,
      abilityModifier: math.abilityModifier, spellAttackBonus: math.spellAttackBonus, spellDc: math.spellDc },
      racialPin: { contentId: root.content_id, version: root.content_version }, traitPin: { contentId: pin.content_id, version: pin.content_version } };
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
