import type { CasterClass, SlotResolution } from "@/lib/types/spells";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { resolveEffectiveCastingSources } from "./effective-sources";
export { computeCasterLevel, resolveSpellSlots } from "./slot-resolution";

/**
 * Compute spell save DC: 8 + proficiency bonus + spellcasting ability mod.
 */
export function computeSpellDc(
  caster: Pick<CasterClass, "ability">,
  abilityScores: Record<string, number>,
  proficiencyBonus: number,
): number {
  const abilityMod = Math.floor(((abilityScores[caster.ability] ?? 10) - 10) / 2);
  return 8 + proficiencyBonus + abilityMod;
}

/**
 * Compute spell attack bonus: proficiency bonus + spellcasting ability mod.
 */
export function computeSpellAttackBonus(
  caster: Pick<CasterClass, "ability">,
  abilityScores: Record<string, number>,
  proficiencyBonus: number,
): number {
  const abilityMod = Math.floor(((abilityScores[caster.ability] ?? 10) - 10) / 2);
  return proficiencyBonus + abilityMod;
}

/**
 * Compute max prepared spells for prepared casters.
 * Paladin: ability mod + floor(level/2), min 1.
 * Cleric/Druid/Wizard: ability mod + class level, min 1.
 * Returns 0 for non-prepared casters (they don't prepare).
 */
export function computeMaxPrepared(
  classSlug: string,
  classLevel: number,
  abilityMod: number,
): number {
  if (classSlug === "paladin") {
    return Math.max(1, abilityMod + Math.floor(classLevel / 2));
  }
  return Math.max(1, abilityMod + classLevel);
}

/** Supply only selected exact class snapshots; a missing/ambiguous pin fails closed. */
export function resolvePinnedSpellSlots(
  classes: unknown,
  refs: ContentRefWithContent[],
  character: { id: string; system_id: string },
): SlotResolution {
  const resolution = resolveEffectiveCastingSources(classes, refs, character);
  return resolution.status === "available" ? resolution.slots : resolution;
}

/**
 * Resolve feature-granted spells (always-prepared from class/subclass features).
 * Reads each class's subclass data.spellcastingExtra and returns entries at or below class level.
 */
export function resolveFeatureGrantedSpells(
  classes: Array<{ slug: string; level: number; subclass?: string }>,
  subclassData: Record<string, { spellcastingExtra?: Array<{ level: number; spells: string[] }> | null }>,
): Array<{ spell_slug: string; class_slug: string }> {
  const result: Array<{ spell_slug: string; class_slug: string }> = [];
  for (const cls of classes) {
    if (!cls.subclass) continue;
    const sub = subclassData[cls.subclass];
    const extras = sub?.spellcastingExtra;
    if (!extras) continue;
    for (const tier of extras) {
      if (tier.level <= cls.level) {
        for (const slug of tier.spells) {
          result.push({ spell_slug: slug, class_slug: cls.slug });
        }
      }
    }
  }
  return result;
}
