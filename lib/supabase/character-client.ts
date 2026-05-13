import { createClient } from "@/lib/supabase/client";

/**
 * Browser-side helper to write a character's primary color.
 * Hex must match /^#[0-9a-fA-F]{6}$/ per the DB check constraint; pass null to clear.
 * RLS gates the write to the row owner.
 */
export async function updateCharacterColor(
  characterId: string,
  primaryColor: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("characters")
    .update({ primary_color: primaryColor })
    .eq("id", characterId);
  if (error) throw new Error(error.message);
}
