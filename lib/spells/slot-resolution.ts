import type { CasterClass, MaxSlotsByLevel, SlotResolution } from "@/lib/types/spells";
import { getMultiClassSlots } from "./multiclass-slots";

/**
 * Compute the effective caster level for multiclass slot calculation.
 * - Full casters (Wizard, Cleric, Druid, Bard, Sorcerer): full class level
 * - Half casters (Paladin, Ranger): floor(classLevel / 2), 0 at level 1
 * - Pact casters (Warlock): 0 (their slots are separate)
 * - Third casters: floor(classLevel / 3); original pinned subclass profiles.
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

/** Resolve one validated slot snapshot, including separate Pact Magic. */
export function resolveSpellSlots(
  classes: unknown,
  profiles: Record<string, unknown>,
): SlotResolution {
  const unavailable = (detail: string): SlotResolution => ({
    status: "unavailable",
    reason: `Spell slots are unavailable: ${detail}. Reload the character or restore its saved class content.`,
  });
  if (!Array.isArray(classes)) return unavailable("invalid class choices");
  const seen = new Set<string>();
  const regular: Array<{ slug: string; level: number; type: CasterClass["type"]; slots: number[] }> = [];
  let pact: { count: number; level: number | null } | null = null;
  let totalLevels = 0;
  for (const raw of classes) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof raw.slug !== "string" || !raw.slug.trim() ||
      !Number.isInteger(raw.level) || raw.level < 1 || raw.level > 20 || seen.has(raw.slug)) {
      return unavailable("invalid or ambiguous class choices");
    }
    seen.add(raw.slug);
    totalLevels += raw.level;
    if (!Object.hasOwn(profiles, raw.slug)) return unavailable(`missing ${raw.slug} profile`);
    const profile = profiles[raw.slug];
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return unavailable(`missing ${raw.slug} profile`);
    const data = profile as Record<string, unknown>;
    const config = data.spellcasting;
    if (config !== null && (!config || typeof config !== "object" || Array.isArray(config) ||
      typeof (config as Record<string, unknown>).type !== "string" ||
      !["full", "half", "third", "pact"].includes((config as { type: string }).type) ||
      typeof (config as Record<string, unknown>).ability !== "string" ||
      !(config as { ability: string }).ability.trim())) return unavailable(`invalid ${raw.slug} profile`);
    if (!Array.isArray(data.levels)) return unavailable(`missing ${raw.slug} progression`);
    // Numbered rows may be sparse or reordered; the selected row must be unique.
    if (Array.from(data.levels).some(row => !row || typeof row !== "object" || Array.isArray(row) ||
      !Number.isInteger(row.level) || row.level < 1 || row.level > 20)) {
      return unavailable(`invalid ${raw.slug} progression levels`);
    }
    const selected = data.levels.filter(row => row.level === raw.level);
    if (selected.length !== 1) return unavailable(`missing or duplicate ${raw.slug} level ${raw.level}`);
    const row = selected[0].spellcasting;
    if (row === null) continue; // Explicitly inactive, never inferred from class name/type.
    if (!row || typeof row !== "object" || Array.isArray(row) || !Array.isArray(row.spell_slots) ||
      row.spell_slots.length !== 9 || Array.from(row.spell_slots).some((n: unknown) =>
        typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 0)) {
      return unavailable(`invalid ${raw.slug} slot row`);
    }
    if (config === null) return unavailable(`${raw.slug} slot row has no casting profile`);
    const type = (config as { type: CasterClass["type"] }).type;
    if (type === "pact") {
      if (pact) return unavailable("multiple Pact Magic sources");
      const populated = row.spell_slots.flatMap((n: number, i: number) => n > 0 ? [i] : []);
      if (populated.length > 1) return unavailable("ambiguous Pact Magic slot levels");
      const index = populated[0];
      pact = { count: index === undefined ? 0 : row.spell_slots[index], level: index === undefined ? null : index + 1 };
    } else {
      // A non-null zero/cantrip-only row is still an active Spellcasting source.
      regular.push({ slug: raw.slug, level: raw.level, type, slots: row.spell_slots });
    }
  }
  if (totalLevels > 20) return unavailable("class levels exceed the supported total");
  const maxSlots: MaxSlotsByLevel = {};
  if (regular.length === 1) {
    regular[0].slots.forEach((count, i) => { if (count > 0) maxSlots[String(i + 1) as keyof MaxSlotsByLevel] = count; });
  } else if (regular.length > 1) {
    Object.assign(maxSlots, getMultiClassSlots(computeCasterLevel(regular)));
  }
  if (pact && pact.count > 0) maxSlots.pact = pact.count;
  return { status: "available", maxSlots, pactSlotLevel: pact?.level ?? null };
}
