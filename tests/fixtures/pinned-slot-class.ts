import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

/** Explicit original rows for provider tests; no inferred row tags or live data. */
export function pinnedSlotClass(slug: string, level: number, type: "full" | "half" | "third" | "pact" | null,
  slots: number[] | null, characterId = "local-character", systemId = "local-system"): ContentRefWithContent {
  return { id: `${slug}-ref`, character_id: characterId, content_id: `${slug}-content`, content_version: 1, context: {}, choice_source: null, created_at: "2026-10-11",
    content_definitions: { id: `${slug}-content`, version: 1, system_id: systemId, content_type: "class", slug, name: slug,
      data: { hit_die: slug === "barbarian" ? 12 : ["fighter", "paladin", "ranger"].includes(slug) ? 10 : 6, spellcasting: type ? { type, ability: slug === "paladin" ? "charisma" : slug === "ranger" ? "wisdom" : "intelligence" } : null,
        levels: [{ level, spellcasting: slots === null ? null : { spell_slots: slots } }] }, effects: [] } } as unknown as ContentRefWithContent;
}
