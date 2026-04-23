"use client";

import { createClient } from "@/lib/supabase/client";
import type { CharacterState } from "@/lib/types/character";

/**
 * Patches the character.state JSONB column with partial updates.
 *
 * Uses the `patch_character_state` Postgres RPC (migration 00031) for an
 * atomic shallow-merge. This eliminates the read-merge-write race that
 * would occur if two state patches interleaved (e.g., spending Rage and
 * spending Ki in quick succession).
 *
 * Shallow merge semantics: top-level keys in `patch` replace existing keys
 * wholesale. Callers that want to update a nested field (e.g., one entry
 * in feature_uses) must pass the full merged nested object.
 */
export async function updateCharacterState(
  characterId: string,
  patch: Partial<CharacterState>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("patch_character_state", {
    character_id: characterId,
    state_patch: patch,
  });
  if (error) throw error;
}
