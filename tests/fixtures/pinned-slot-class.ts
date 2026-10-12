import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { classDataSchema } from "@/lib/schemas/content-types/class";

/** Explicit original rows for provider tests; no inferred row tags or live data. */
export function pinnedSlotClass(slug: string, level: number, type: "full" | "half" | "third" | "pact" | null,
  slots: number[] | null, characterId = "local-character", systemId = "local-system"): ContentRefWithContent {
  const slugHex = Array.from(slug).map(character => character.charCodeAt(0).toString(16).padStart(2, "0")).join("").padEnd(32, "0").slice(0, 32);
  const refId = `${slugHex.slice(0, 8)}-${slugHex.slice(8, 12)}-4${slugHex.slice(13, 16)}-8${slugHex.slice(17, 20)}-${slugHex.slice(20)}`;
  return { id: refId, character_id: characterId, content_id: `${slug}-content`, content_version: 1, feature_grant_id: null, context: {}, choice_source: null, created_at: "2026-10-11",
    content_definitions: { id: `${slug}-content`, version: 1, system_id: systemId, content_type: "class", slug, name: slug,
      data: classDataSchema.parse({ hit_die: slug === "barbarian" ? 12 : ["fighter", "paladin", "ranger"].includes(slug) ? 10 : 6, spellcasting: type ? { type, ability: slug === "paladin" ? "charisma" : slug === "ranger" ? "wisdom" : "intelligence" } : null,
        multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
        levels: [{ level, features: [], spellcasting: slots === null ? null : { spell_slots: slots } }] }), effects: [] } } as unknown as ContentRefWithContent;
}
