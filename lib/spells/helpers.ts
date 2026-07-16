import type { CasterClass, MaxSlotsByLevel } from "@/lib/types/spells";
import { getMultiClassSlots } from "@/lib/spells/multiclass-slots";

/**
 * Compute spell save DC: 8 + proficiency bonus + spellcasting ability mod.
 */
export function computeSpellDc(
  caster: CasterClass,
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
  caster: CasterClass,
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

/**
 * Compute the effective caster level for multiclass slot calculation.
 * - Full casters (Wizard, Cleric, Druid, Bard, Sorcerer): full class level
 * - Half casters (Paladin, Ranger): floor(classLevel / 2), 0 at level 1
 * - Pact casters (Warlock): 0 (their slots are separate)
 * - Third casters (Eldritch Knight, Arcane Trickster): floor(classLevel / 3) — not in SRD, deferred
 */
export function computeCasterLevel(
  classes: Array<{ slug: string; level: number; type: CasterClass["type"] | null }>,
): number {
  let total = 0;
  for (const c of classes) {
    if (!c.type) continue;
    if (c.type === "full") {
      total += c.level;
    } else if (c.type === "half") {
      if (c.level >= 2) total += Math.floor(c.level / 2);
    } else if (c.type === "third") {
      if (c.level >= 3) total += Math.floor(c.level / 3);
    }
    // pact contributes 0 to multiclass slots
  }
  return total;
}

/**
 * Compute max slots for a character.
 * - Warlock pact slots come from warlock class data (separate from regular pool)
 * - Non-warlock slots come from the multiclass spellcaster table with caster level
 *   summed from all full/half/third casters
 */
export function computeMaxSlots(
  classes: Array<{ slug: string; level: number; type: CasterClass["type"] | null }>,
  classData: Record<string, { levels?: Array<{ spellcasting?: { spell_slots?: number[] } | null }> }>,
): MaxSlotsByLevel {
  const result: MaxSlotsByLevel = {};

  // Warlock pact slots
  const warlock = classes.find((c) => c.slug === "warlock");
  if (warlock) {
    const warlockData = classData["warlock"];
    const slots = warlockData?.levels?.[warlock.level - 1]?.spellcasting?.spell_slots;
    if (slots) {
      // Warlock pact slots: one slot level populated at a time, count at that level
      let total = 0;
      for (const s of slots) total += s;
      if (total > 0) result.pact = total;
    }
  }

  // Non-warlock: multiclass caster level → slot table
  const casterLevel = computeCasterLevel(classes);
  if (casterLevel > 0) {
    Object.assign(result, getMultiClassSlots(casterLevel));
  }

  return result;
}

/**
 * Compute the pact slot LEVEL for a warlock (the slot level all pact slots
 * share, e.g. warlock 3 → 2nd-level slots). `computeMaxSlots` collapses the
 * pact pool to a count; the cast dialog also needs the level so pact slots
 * can be offered as a first-class cast option. Returns null when the
 * character has no pact slots.
 */
export function computePactSlotLevel(
  classes: Array<{ slug: string; level: number }>,
  classData: Record<string, { levels?: Array<{ spellcasting?: { spell_slots?: number[] } | null }> }>,
): number | null {
  const warlock = classes.find((c) => c.slug === "warlock");
  if (!warlock) return null;
  const slots = classData["warlock"]?.levels?.[warlock.level - 1]?.spellcasting?.spell_slots;
  if (!slots) return null;
  const index = slots.findIndex((s) => s > 0);
  return index >= 0 ? index + 1 : null;
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
