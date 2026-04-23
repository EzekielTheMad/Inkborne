import { createClient } from "@/lib/supabase/client";
import type { CharacterSpell, AddSpellPayload, SpellUpdate } from "@/lib/types/spells";

const SPELLS_SELECT =
  "*, content_definitions(id, name, slug, content_type, data, effects)";

export async function getSpellsForCharacter(
  characterId: string,
): Promise<CharacterSpell[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_spells")
    .select(SPELLS_SELECT)
    .eq("character_id", characterId)
    .order("name");

  if (error) {
    console.error("[getSpellsForCharacter] Error:", error.message);
    return [];
  }
  return (data ?? []) as CharacterSpell[];
}

export async function addCharacterSpell(
  characterId: string,
  payload: AddSpellPayload,
): Promise<CharacterSpell | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_spells")
    .insert({
      character_id: characterId,
      content_id: payload.content_id ?? null,
      name: payload.name,
      class_slug: payload.class_slug,
      is_known: payload.is_known ?? false,
      is_prepared: payload.is_prepared ?? false,
      in_spellbook: payload.in_spellbook ?? false,
      source: "selection",
      custom_data: payload.custom_data ?? null,
    })
    .select(SPELLS_SELECT)
    .single();

  if (error) {
    console.error("[addCharacterSpell] Error:", error.message);
    return null;
  }
  return data as CharacterSpell;
}

export async function updateCharacterSpell(
  spellId: string,
  updates: SpellUpdate,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_spells")
    .update(updates)
    .eq("id", spellId);

  if (error) {
    console.error("[updateCharacterSpell] Error:", error.message);
  }
}

export async function removeCharacterSpell(spellId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_spells")
    .delete()
    .eq("id", spellId);

  if (error) {
    console.error("[removeCharacterSpell] Error:", error.message);
  }
}

export interface SearchSpellsOptions {
  classSlug?: string; // filter to spells available to this class
  level?: number; // exact level filter; use 0 for cantrips
  school?: string;
  ritualOnly?: boolean;
  concentrationOnly?: boolean;
}

export async function searchSpells(
  systemId: string,
  query: string,
  options?: SearchSpellsOptions,
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
  }>
> {
  const supabase = createClient();
  let builder = supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data")
    .eq("system_id", systemId)
    .eq("content_type", "spell")
    .eq("scope", "platform")
    .ilike("name", `%${query}%`);

  if (options?.classSlug) {
    // Filter to spells where data.classes array contains classSlug
    builder = builder.contains("data->classes", JSON.stringify([options.classSlug]));
  }
  if (options?.level != null) {
    builder = builder.eq("data->>level", String(options.level));
  }
  if (options?.school) {
    builder = builder.eq("data->>school", options.school);
  }
  if (options?.ritualOnly) {
    builder = builder.eq("data->>ritual", "true");
  }
  if (options?.concentrationOnly) {
    builder = builder.eq("data->>concentration", "true");
  }

  const { data, error } = await builder.order("name").limit(50);
  if (error) {
    console.error("[searchSpells] Error:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Idempotently ensures `character_spells` has a row for each always-prepared spell
 * that the character's class/subclass features grant at the current level.
 * Removes rows whose source='feature' but are no longer in the resolved set
 * (e.g., subclass changed).
 */
export async function syncAlwaysPreparedSpells(
  characterId: string,
  granted: Array<{ spell_slug: string; class_slug: string }>,
  spellIdBySlug: Record<string, string>,
): Promise<void> {
  const supabase = createClient();

  // Load existing feature-sourced rows.
  const { data: existingRows } = await supabase
    .from("character_spells")
    .select("id, class_slug, content_id")
    .eq("character_id", characterId)
    .eq("source", "feature");

  const existing = (existingRows ?? []) as Array<{
    id: string;
    class_slug: string;
    content_id: string | null;
  }>;

  // Build the "desired" set using content IDs.
  const desired = new Set<string>();
  const toInsert: Array<{
    character_id: string;
    content_id: string;
    name: string;
    class_slug: string;
    is_prepared: boolean;
    always_prepared: boolean;
    source: string;
  }> = [];

  // Load spell names for the desired slugs (we need name for the row).
  const slugs = Array.from(new Set(granted.map((g) => g.spell_slug)));
  const { data: spellRows } = await supabase
    .from("content_definitions")
    .select("id, slug, name")
    .in("slug", slugs)
    .eq("content_type", "spell")
    .eq("scope", "platform");

  const nameBySlug: Record<string, string> = {};
  for (const r of spellRows ?? []) {
    nameBySlug[r.slug] = r.name;
    spellIdBySlug[r.slug] = r.id;
  }

  for (const g of granted) {
    const contentId = spellIdBySlug[g.spell_slug];
    if (!contentId) continue; // spell not in DB; skip silently
    const key = `${contentId}:${g.class_slug}`;
    desired.add(key);
    const alreadyHave = existing.some(
      (e) => e.content_id === contentId && e.class_slug === g.class_slug,
    );
    if (!alreadyHave) {
      toInsert.push({
        character_id: characterId,
        content_id: contentId,
        name: nameBySlug[g.spell_slug] ?? g.spell_slug,
        class_slug: g.class_slug,
        is_prepared: true,
        always_prepared: true,
        source: "feature",
      });
    }
  }

  // Insert new ones.
  if (toInsert.length > 0) {
    await supabase.from("character_spells").insert(toInsert);
  }

  // Delete stale ones (feature-sourced, no longer granted).
  const staleIds = existing
    .filter((e) => {
      if (!e.content_id) return false;
      return !desired.has(`${e.content_id}:${e.class_slug}`);
    })
    .map((e) => e.id);
  if (staleIds.length > 0) {
    await supabase.from("character_spells").delete().in("id", staleIds);
  }
}
