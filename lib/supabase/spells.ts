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
