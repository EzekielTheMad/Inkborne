import { createClient } from "@/lib/supabase/client";
import type {
  CharacterChoices,
  CharacterUpdatePatch,
} from "@/lib/types/character";

/**
 * Browser-side helper to write a partial patch to a characters row.
 * Throws on supabase `{ error }` (RLS denial, check-constraint violation,
 * network). Caller is responsible for optimistic state + revert on failure.
 *
 * Empty patches are a no-op (defensive — protects against accidental
 * `.update({})` writes that supabase treats as a row-touch).
 */
export async function updateCharacter(
  characterId: string,
  patch: CharacterUpdatePatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("characters")
    .update(patch)
    .eq("id", characterId);
  if (error) throw new Error(error.message);
}

/**
 * Writes a builder patch and returns the row after database triggers finish.
 *
 * Level changes use this path because the database may prune choices that are
 * no longer earned. Returning that canonical snapshot prevents stale client
 * state from restoring a removed choice later in the same builder session.
 */
export async function updateCharacterAndReturn(
  characterId: string,
  patch: CharacterUpdatePatch,
): Promise<{ choices: CharacterChoices; level: number }> {
  if (Object.keys(patch).length === 0) {
    throw new Error("A character update cannot be empty.");
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("characters")
    .update(patch)
    .eq("id", characterId)
    .select("choices, level")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("The updated character could not be loaded.");

  return {
    choices: (data.choices ?? {}) as CharacterChoices,
    level: data.level,
  };
}

/**
 * Browser-side helper to write a character's primary color.
 * Hex must match /^#[0-9a-fA-F]{6}$/ per the DB check constraint; pass null to clear.
 * RLS gates the write to the row owner.
 *
 * Delegates to updateCharacter so the validation + error-handling path is shared.
 */
export async function updateCharacterColor(
  characterId: string,
  primaryColor: string | null,
): Promise<void> {
  await updateCharacter(characterId, { primary_color: primaryColor });
}
