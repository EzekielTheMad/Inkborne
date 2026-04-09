"use client";

import { createClient } from "@/lib/supabase/client";
import type { CharacterState } from "@/lib/types/character";

/** Patches the character.state JSONB column with partial updates. */
export async function updateCharacterState(
  characterId: string,
  patch: Partial<CharacterState>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("patch_character_state", {
    character_id: characterId,
    state_patch: patch,
  });

  // Fallback: if RPC doesn't exist, do a read-merge-write
  if (error) {
    const { data } = await supabase
      .from("characters")
      .select("state")
      .eq("id", characterId)
      .single();

    const merged = { ...(data?.state ?? {}), ...patch };
    const { error: updateError } = await supabase
      .from("characters")
      .update({ state: merged })
      .eq("id", characterId);

    if (updateError) throw updateError;
  }
}
