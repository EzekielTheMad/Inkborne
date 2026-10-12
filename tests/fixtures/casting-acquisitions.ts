import { classDataSchema } from "@/lib/schemas/content-types/class";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import type { CastingAbilityInput } from "@/lib/spells/casting-ability";
import type { CharacterSpell } from "@/lib/types/spells";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

export function castingAcquisition(classSlug = "wizard", id = `${classSlug}-acquisition`): CharacterSpell {
  return { id, character_id: "local-character", content_id: "original-spell", content_version: 2, name: "Prism Signal", class_slug: classSlug,
    is_known: true, is_prepared: true, always_prepared: false, in_spellbook: classSlug === "wizard", source: "selection", custom_data: null, created_at: "2026-10-11",
    content_definitions: { id: "original-spell", version: 2, system_id: "local-system", slug: "prism-signal", name: "Prism Signal", content_type: "spell", owner_id: "other-author", source: "homebrew", scope: "shared",
      data: spellDataSchema.parse({ level: 1, school: "evocation", casting_time: "1 action", range: "60 feet", components: ["V"], duration: "1 minute", concentration: true, ritual: true, description: "An original light used to verify acquisition-specific casting.", attack_type: "ranged", damage: { type: "force", dice_at_slot_level: { "1": "1d8 + MOD", "2": "2d8 + MOD" } }, heal_at_slot_level: { "1": "1d4 + MOD" }, dc: { type: "dexterity", success: "half" } }),
      effects: [{ type: "mechanical", stat: "initiative", op: "add", value: 1 }] } } as unknown as CharacterSpell;
}

export function castingClassRef(slug: "wizard" | "warlock"): ContentRefWithContent {
  const ability = slug === "wizard" ? "intelligence" : "charisma";
  return { id: `${slug}-ref`, character_id: "local-character", content_id: `${slug}-content`, content_version: 1, context: {}, choice_source: null, created_at: "2026-10-11",
    content_definitions: { id: `${slug}-content`, version: 1, system_id: "local-system", slug, name: slug, content_type: "class", owner_id: "other-author", source: "homebrew", scope: "shared", effects: [],
      data: classDataSchema.parse({ hit_die: slug === "wizard" ? 6 : 8, spellcasting: { type: slug === "wizard" ? "full" : "pact", ability, ritual_casting: true }, multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [], spellcastingKnown: { prepared: slug === "wizard", spells: "all" }, levels: [{ level: 3, features: [], spellcasting: { spell_slots: slug === "wizard" ? [4, 2, 0, 0, 0, 0, 0, 0, 0] : [0, 2, 0, 0, 0, 0, 0, 0, 0] } }] }) } } as unknown as ContentRefWithContent;
}

export function castingAbilityFixture(intelligence = 18, charisma = 10): CastingAbilityInput {
  return { character: { id: "local-character", system_id: "local-system", choices: { classes: [{ slug: "wizard", level: 3 }, { slug: "warlock", level: 3 }] } },
    spells: [castingAcquisition(), castingAcquisition("warlock")], contentRefs: [castingClassRef("wizard"), castingClassRef("warlock")], abilities: [{ slug: "intelligence" }, { slug: "charisma" }], abilityScores: { intelligence, charisma }, proficiencyBonus: 3 };
}

/** Original state-only spell for save/conflict fixtures; each variant is its own loaded acquisition. */
export function stateCastingAcquisition(id = "local-spell", options: { characterId?: string; systemId?: string; level?: number; duration?: string; concentration?: boolean; ritual?: boolean } = {}): CharacterSpell {
  const row = castingAcquisition("wizard", id);
  return { ...row, character_id: options.characterId ?? "local-character", content_id: id, name: "Local Focus",
    content_definitions: { ...row.content_definitions!, id, system_id: options.systemId ?? "local-system", name: "Local Focus", slug: "focus", effects: [],
      data: spellDataSchema.parse({ level: options.level ?? 1, school: "abjuration", casting_time: "1 action", range: "Self", components: ["V"], duration: options.duration ?? "1 minute", concentration: options.concentration ?? true, ritual: options.ritual ?? false, description: "An original focus used to test conditional saves." }) } };
}
