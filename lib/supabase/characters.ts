import { createClient } from "@/lib/supabase/server";
import type {
  Character,
  CharacterWithSystem,
} from "@/lib/types/character";

export async function getCharactersByUser(
  userId: string,
): Promise<Character[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCharacterById(
  id: string,
): Promise<Character | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getCharacterWithSystem(
  id: string,
): Promise<CharacterWithSystem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select(
      `*, game_systems (id, name, slug, schema_definition)`,
    )
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as CharacterWithSystem | null;
}

export async function createCharacter(params: {
  name: string;
  user_id: string;
  system_id: string;
  campaign_id?: string | null;
}): Promise<Character> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .insert([
      {
        name: params.name,
        user_id: params.user_id,
        system_id: params.system_id,
        campaign_id: params.campaign_id ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCharacter(
  id: string,
  updates: Partial<
    Pick<Character, "name" | "level" | "base_stats" | "choices" | "state" | "visibility" | "archived" | "campaign_id">
  >,
): Promise<Character> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPublishedSystems(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_systems")
    .select("id, name, slug")
    .eq("status", "published");

  if (error) throw error;
  return data ?? [];
}
