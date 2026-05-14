import { createClient } from "@/lib/supabase/client";
import type { CharacterContentRef } from "@/lib/types/character";

// Browser-side helpers for character_content_refs. Live in a separate module
// from content-refs.ts because that file imports next/headers via the server
// supabase client at module load; Turbopack pulls that into the client bundle
// whenever a "use client" component value-imports from it.

export interface InsertContentRefParams {
  characterId: string;
  contentId: string;
  contentVersion: number;
  context: Record<string, unknown>;
  choiceSource?: string | null;
}

/**
 * Browser-side: insert a single content_ref row and return the inserted record.
 * Used by builder step-clients (race/class/subclass/background/fighting-style
 * selection).
 */
export async function insertContentRef(
  params: InsertContentRefParams,
): Promise<CharacterContentRef> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .insert([
      {
        character_id: params.characterId,
        content_id: params.contentId,
        content_version: params.contentVersion,
        context: params.context,
        choice_source: params.choiceSource ?? null,
      },
    ])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Browser-side: delete one content_ref row by its primary key. Used by
 * builder step-clients when swapping a selection — the caller has the id
 * already from the contentRefs prop and skips an extra lookup.
 */
export async function removeContentRefById(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("character_content_refs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
