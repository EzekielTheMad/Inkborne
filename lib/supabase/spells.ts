import { createClient } from "@/lib/supabase/client";
import {
  parseContentDefinitions,
  parseNestedContentVersionSnapshot,
  type ParsedContentDefinition,
} from "@/lib/supabase/content-definitions-parser";
import type { CharacterSpell, AddSpellPayload, SpellUpdate } from "@/lib/types/spells";

const SPELLS_SELECT =
  `*, content_versions!character_spells_content_version_fkey(
    content_id, version, system_id_snapshot, content_type_snapshot,
    slug_snapshot, name_snapshot, data_snapshot, effects_snapshot,
    source_snapshot, scope_snapshot, owner_id_snapshot
  )`;

function parseCharacterSpellRow(
  raw: Record<string, unknown>,
): CharacterSpell {
  return {
    ...raw,
    content_definitions: parseNestedContentVersionSnapshot(
      raw.content_versions,
    ),
  } as unknown as CharacterSpell;
}

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
    throw error;
  }
  return (data ?? []).map((row) =>
    parseCharacterSpellRow(row as Record<string, unknown>),
  );
}

export async function addCharacterSpell(
  characterId: string,
  payload: AddSpellPayload,
): Promise<CharacterSpell | null> {
  if (payload.content_id && !Number.isInteger(payload.content_version)) {
    throw new Error("A definition-backed spell requires a content version.");
  }
  if (!payload.content_id && payload.content_version != null) {
    throw new Error("A custom spell cannot specify a content version.");
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_spells")
    .insert({
      character_id: characterId,
      content_id: payload.content_id ?? null,
      content_version: payload.content_id ? payload.content_version : null,
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
    throw error;
  }
  return data
    ? parseCharacterSpellRow(data as Record<string, unknown>)
    : null;
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
    throw error;
  }
}

export async function removeCharacterSpell(spellId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_spells")
    .delete()
    .eq("id", spellId);

  if (error) {
    throw error;
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
  characterId: string,
  query: string,
  options?: SearchSpellsOptions,
): Promise<
  ParsedContentDefinition[]
> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "search_usable_spells_for_character",
    {
      target_character_id: characterId,
      search_query: query,
      class_slug: options?.classSlug,
      spell_level: options?.level,
      spell_school: options?.school,
      ritual_only: options?.ritualOnly ?? false,
      concentration_only: options?.concentrationOnly ?? false,
      result_limit: 50,
    },
  );
  if (error) {
    throw error;
  }
  return parseContentDefinitions(data ?? []);
}
