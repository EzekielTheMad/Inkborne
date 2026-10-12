import { parseContentVersionSnapshot, type ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { CharacterSpell } from "@/lib/types/spells";

export const originalId = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
export const subclassCharacterId = originalId(1), subclassSystemId = originalId(2), subclassOwnerId = originalId(3);
const createdAt = "2026-10-11T12:00:00.000Z";
export function originalSnapshot(slug: string, contentType: string, data: Record<string, unknown>, n: number, version = 1) {
  return { content_id: originalId(n), version, system_id_snapshot: subclassSystemId, slug_snapshot: slug, name_snapshot: slug,
    content_type_snapshot: contentType, data_snapshot: data, effects_snapshot: [], source_snapshot: "homebrew", scope_snapshot: "personal", owner_id_snapshot: subclassOwnerId, created_at: createdAt };
}
export function rawOriginalRef(snapshot: ReturnType<typeof originalSnapshot>) {
  return { id: originalId(Number.parseInt(snapshot.content_id.slice(-12), 16) + 1000), character_id: subclassCharacterId, content_id: snapshot.content_id, content_version: snapshot.version,
    context: {}, choice_source: null, feature_grant_id: null, created_at: createdAt, content_versions: snapshot };
}
export function originalRef(snapshot: ReturnType<typeof originalSnapshot>): ContentRefWithContent {
  const parsed = parseContentVersionSnapshot(snapshot);
  if (!parsed) throw new Error(`Invalid original snapshot: ${snapshot.slug_snapshot}`);
  const raw = rawOriginalRef(snapshot);
  return { feature_grant_id: null, id: raw.id, character_id: raw.character_id, content_id: raw.content_id, content_version: raw.content_version, context: raw.context,
    choice_source: raw.choice_source, created_at: raw.created_at, content_definitions: parsed };
}
export function originalParent(slug = "warden", type: "full" | "half" | "third" | "pact" | null = null, slots: number[] | null = null, n = 10): ContentRefWithContent {
  return originalRef(originalSnapshot(slug, "class", { hit_die: 10, description: "An original guardian used for bounded casting tests.",
    spellcasting: type ? { type, ability: "charisma", focus: "original emblem", ritual_casting: false } : null,
    multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
    spellcastingKnown: { cantrips: Array(20).fill(2), spells: Array(20).fill(4), prepared: false },
    spellcastingList: { class: slug, level: [0, 9] },
    levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features: [], spellcasting: slots === null ? null : { spell_slots: slots } })), source_refs: [] }, n));
}
export function originalSubclassData(prepared = false): Record<string, unknown> {
  return { parent_class: "warden", description: "An originally authored light-weaving discipline.", flavor_label: "Light discipline", spells: [],
    spellcasting: { type: "third", ability: "intelligence", focus: "original sigil", ritual_casting: false },
    spellcastingKnown: { cantrips: Array.from({ length: 20 }, (_, i) => i < 2 ? 0 : 2), spells: prepared ? "all" : Array.from({ length: 20 }, (_, i) => i < 2 ? 0 : i < 4 ? 3 : 4), prepared },
    spellcastingList: { class: "original-scholar", level: [0, 2] }, ...(prepared ? { preparation_rule: "class-level-plus-ability" } : {}),
    levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features: [], spellcasting: i < 2 ? null : { cantrips_known: 2, spell_slots: i < 4 ? [3, 0, 0, 0, 0, 0, 0, 0, 0] : [4, 1, 0, 0, 0, 0, 0, 0, 0] } })) };
}
export function originalSubclass(data = originalSubclassData(), version = 1): ContentRefWithContent {
  return originalRef(originalSnapshot("lumen-adept", "subclass", data, 20, version));
}
export function originalGrantData(parentClass = "warden"): Record<string, unknown> {
  return { parent_class: parentClass, levels: [{ level: 1, features: [] }, { level: 6, features: [] }], spells: ["prism-mark"],
    spellcastingExtra: [{ level: 1, spells: ["prism-mark"] }, { level: 3, spells: ["quiet-beacon"] }] };
}
export function originalSpell(classSlug = "warden", version = 2): CharacterSpell {
  const snapshot = originalSnapshot("prism-mark", "spell", { level: 1, school: "illusion", casting_time: "1 action", range: "30 feet", components: ["V"],
    description: "An original sign of light for local casting validation.", duration: "1 minute", concentration: true, ritual: false, attack_type: "ranged",
    damage: { type: "radiant", dice_at_slot_level: { "1": "1d8 + MOD", "2": "2d8 + MOD" } }, dc: { type: "dexterity", success: "half" }, classes: ["original-scholar"] }, 30, version);
  return { id: originalId(100), character_id: subclassCharacterId, content_id: snapshot.content_id, content_version: version, class_slug: classSlug, name: "Prism Mark",
    is_known: true, is_prepared: false, always_prepared: false, in_spellbook: false, source: "selection", custom_data: null, created_at: createdAt,
    content_definitions: parseContentVersionSnapshot(snapshot) as ParsedContentDefinition };
}
export function originalSubclassFixture(level = 3) {
  return { character: { id: subclassCharacterId, system_id: subclassSystemId, choices: { classes: [{ slug: "warden", level, subclass: "lumen-adept" }] as Array<{ slug: string; level: number; subclass?: string }> } },
    contentRefs: [originalParent(), originalSubclass()], spells: [originalSpell()], abilities: [{ slug: "intelligence" }, { slug: "charisma" }], abilityScores: { intelligence: 14, charisma: 10 }, proficiencyBonus: 2 };
}
