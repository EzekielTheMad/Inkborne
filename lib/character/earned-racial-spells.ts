import { z } from "zod";
import { earnedRacialSpellsSchema, earnedRacialSpellSourceSchema, infernalLegacyDeclarationsSupported } from "@/lib/schemas/racial-spells";
import type { CharacterChoices } from "@/lib/types/character";
import type { CharacterSpell } from "@/lib/types/spells";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { builderClassRoleSchema, classRoleForRef, originalClassOccurrence } from "./builder-class-roles";
import { classRoleRevisionSchema } from "./class-role-effects-schema";
import { classOriginInstantMicros } from "./class-origin-command-schema";

export interface EarnedRacialCharacter {
  id: string; system_id: string; choices: CharacterChoices;
  level?: number; action_revision?: string | number; revision?: string;
}
export interface EarnedRacialSpellInfo {
  grantKey: "infernal-legacy:3:hellish-rebuke" | "infernal-legacy:5:darkness";
  characterLevel: 3 | 5; spellLevel: 1 | 2; castLevel: 2; ability: "charisma";
}
export type EarnedRacialSpellResolution = { status: "unavailable" } | {
  status: "available"; racialPin: { contentId: string; version: number };
  traitPin: { contentId: string; version: number }; earnedRacial: EarnedRacialSpellInfo;
};
const uuid = z.uuid(), version = z.number().int().min(1).max(2147483647);

/** Read an acquisition already selected from the current loaded spell rows.
 * Native production remains write authority. A slug, optional timestamp or a
 * different class's spell budget never supplies missing positive evidence.
 */
export function resolveEarnedRacialSpell(spell: CharacterSpell, character: EarnedRacialCharacter,
  refs: readonly ContentRefWithContent[], snapshotsComplete: boolean): EarnedRacialSpellResolution {
  const unavailable = { status: "unavailable" as const };
  const parsed = earnedRacialSpellSourceSchema.safeParse(spell.custom_data);
  if (!snapshotsComplete || !parsed.success || spell.source !== "racial_trait" || spell.character_id !== character.id
    || !uuid.safeParse(character.id).success || !uuid.safeParse(character.system_id).success
    || spell.class_slug !== "race:tiefling" || spell.spell_grant_id !== null
    || !spell.is_known || !spell.is_prepared || !spell.always_prepared || spell.in_spellbook
    || !uuid.safeParse(spell.id).success || !Array.isArray(refs) || refs.length > 4096
    || refs.some(ref => !ref || !ref.content_definitions || !ref.content_definitions.data
      || typeof ref.content_definitions.data !== "object" || Array.isArray(ref.content_definitions.data)
      || !Array.isArray(ref.content_definitions.effects))
    || new Set(refs.map(ref => ref.id)).size !== refs.length) return unavailable;
  const source = parsed.data;
  const exact = (ref: ContentRefWithContent) => uuid.safeParse(ref.id).success && ref.character_id === character.id
    && uuid.safeParse(ref.content_id).success && version.safeParse(ref.content_version).success
    && ref.content_id === ref.content_definitions?.id && ref.content_version === ref.content_definitions.version
    && ref.content_definitions.system_id === character.system_id && ref.content_definitions.source === "srd"
    && ref.content_definitions.scope === "platform" && ref.content_definitions.owner_id === null;
  const roots = refs.filter(ref => ["race", "subrace"].includes(ref.content_definitions?.content_type));
  const root = roots[0];
  if (roots.length !== 1 || !root || !exact(root) || root.id !== source.builder_root_ref_id
    || root.content_definitions.content_type !== "race" || root.content_definitions.slug !== "tiefling"
    || character.choices?.race !== "tiefling" || character.choices.subrace
    || root.feature_grant_id !== null || root.choice_source !== null
    || root.context?.source !== "race" || Object.keys(root.context).length !== 1) return unavailable;
  const policy = earnedRacialSpellsSchema.safeParse(root.content_definitions.data.earned_racial_spells);
  const traits = root.content_definitions.data.traits;
  if (!policy.success || !Array.isArray(traits) || traits.filter(slug => slug === policy.data.source_trait).length !== 1) return unavailable;
  const traitPins = refs.filter(ref => ref.content_definitions?.content_type === "trait"
    && ref.content_definitions.slug === policy.data.source_trait);
  const trait = traitPins[0];
  if (traitPins.length !== 1 || !trait || !exact(trait) || trait.id !== source.builder_source_pin_id
    || trait.feature_grant_id !== null || trait.choice_source !== "builder:racial-trait:infernal-legacy"
    || trait.context?.source !== "racial_trait" || trait.context.root_controller_ref_id !== root.id
    || Object.keys(trait.context).length !== 2
    || !Array.isArray(trait.content_definitions.data.races) || trait.content_definitions.data.races.length !== 1
    || trait.content_definitions.data.races[0] !== "tiefling"
    || (trait.content_definitions.data.subraces !== undefined && (!Array.isArray(trait.content_definitions.data.subraces)
      || trait.content_definitions.data.subraces.length !== 0))
    || !infernalLegacyDeclarationsSupported("trait", "infernal-legacy", trait.content_definitions.effects)) return unavailable;
  const abilities = trait.content_definitions.effects.filter(effect => effect.type === "grant" && effect.stat === "spellcasting_ability");
  const fixedSpells = trait.content_definitions.effects.filter(effect => effect.type === "grant" && effect.stat === "spell");
  if (abilities.length !== 1 || abilities[0].type !== "grant" || abilities[0].value !== "charisma"
    || fixedSpells.length !== 1 || fixedSpells[0].type !== "grant" || fixedSpells[0].value !== "thaumaturgy") return unavailable;

  const classes = character.choices.classes ?? [], classPins = refs.filter(ref => ref.content_definitions?.content_type === "class");
  const rawRevision = character.action_revision ?? character.revision;
  const revision = typeof rawRevision === "string" ? rawRevision : Number.isSafeInteger(rawRevision) ? String(rawRevision) : null;
  if (!classRoleRevisionSchema.safeParse(revision).success || revision === "0" || !Number.isInteger(character.level) || character.level! < 1 || character.level! > 20
    || !Array.isArray(classes) || classes.length < 1 || classes.length > 20 || classPins.length !== classes.length
    || classes.some(cls => !cls || typeof cls.slug !== "string")
    || new Set(classes.map(cls => cls.slug)).size !== classes.length || new Set(classes.map(cls => cls.occurrence_id)).size !== classes.length
    || classes.some(cls => !uuid.safeParse(cls.occurrence_id).success || !Number.isInteger(cls.level) || cls.level < 1 || cls.level > 20)
    || classes.reduce((sum, cls) => sum + cls.level, 0) !== character.level || !originalClassOccurrence(classPins, character.choices)) return unavailable;
  for (const cls of classes) {
    const pins = classPins.filter(ref => ref.content_definitions.slug === cls.slug), pin = pins[0];
    if (pins.length !== 1 || !pin || !exact(pin) || pin.context?.source !== "class" || pin.feature_grant_id !== null
      || !builderClassRoleSchema.safeParse(pin.class_role).success) return unavailable;
    const levels = pin.content_definitions.data.levels;
    if (!Array.isArray(levels) || levels.length < 1 || levels.length > 20
      || levels.some(row => !row || typeof row !== "object" || !Number.isInteger(row.level) || row.level < 1 || row.level > 20)
      || new Set(levels.map(row => row.level)).size !== levels.length
      || levels.filter(row => row.level === cls.level).length !== 1) return unavailable;
    const role = classRoleForRef(pin, character.choices);
    if (!role || role.action_revision !== revision || role.occurrence_id !== cls.occurrence_id) return unavailable;
  }
  const grant = source.builder_earned_racial_spell;
  const declaration = policy.data.grants.find(row => row.character_level === grant.character_level
    && row.spell_level === grant.spell_level && row.cast_level === grant.cast_level
    && `${policy.data.source_trait}:${row.character_level}:${row.spell}` === grant.grant_key);
  const definition = spell.content_definitions;
  if (!declaration || character.level! < declaration.character_level || !definition || !uuid.safeParse(spell.content_id).success
    || !version.safeParse(spell.content_version).success || definition.id !== spell.content_id || definition.version !== spell.content_version
    || definition.system_id !== character.system_id || definition.source !== "srd" || definition.scope !== "platform" || definition.owner_id !== null
    || definition.content_type !== "spell" || definition.slug !== declaration.spell || definition.data.level !== declaration.spell_level
    || spell.name !== definition.name) return unavailable;
  // Loaded children must be no newer than the meaningful ROOT cutoff. Native
  // production separately resolves the latest immutable child as of that root.
  const rootAt = classOriginInstantMicros(root.content_definitions.version_created_at);
  const traitAt = classOriginInstantMicros(trait.content_definitions.version_created_at);
  const spellAt = classOriginInstantMicros(definition.version_created_at);
  if (rootAt === null || traitAt === null || spellAt === null || traitAt > rootAt || spellAt > rootAt) return unavailable;
  return { status: "available", racialPin: { contentId: root.content_id, version: root.content_version },
    traitPin: { contentId: trait.content_id, version: trait.content_version }, earnedRacial: {
      grantKey: grant.grant_key, characterLevel: grant.character_level, spellLevel: grant.spell_level,
      castLevel: grant.cast_level, ability: "charisma" } };
}
