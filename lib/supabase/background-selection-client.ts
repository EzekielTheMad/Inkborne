import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import type { CharacterChoices } from "@/lib/types/character";

const backgroundSelectionResultSchema = z
  .object({
    saved_choices: z.record(z.string(), z.unknown()),
    selected_content_id: z.string().uuid().nullable(),
    selected_content_version: z.number().int().positive().nullable(),
  })
  .refine(
    (value) =>
      (value.selected_content_id === null)
      === (value.selected_content_version === null),
    "The selected background identity is incomplete.",
  );

export interface CharacterBackgroundSelectionResult {
  savedChoices: CharacterChoices;
  selectedContentId: string | null;
  selectedContentVersion: number | null;
}

/**
 * Select or clear a character background through the canonical atomic RPC.
 * The database owns authorization, exact-version validation, choices/ref
 * synchronization, and removal of resolutions belonging to the old pin.
 */
export async function setCharacterBackground(
  characterId: string,
  contentId: string | null,
  contentVersion: number | null,
): Promise<CharacterBackgroundSelectionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_character_background", {
    target_character_id: characterId,
    target_content_id: contentId,
    target_content_version: contentVersion,
  });

  if (error) throw new Error(error.message);
  const candidate = Array.isArray(data) ? data[0] : data;
  const parsed = backgroundSelectionResultSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error("The saved background response was invalid.");
  }

  return {
    savedChoices: parsed.data.saved_choices as CharacterChoices,
    selectedContentId: parsed.data.selected_content_id,
    selectedContentVersion: parsed.data.selected_content_version,
  };
}
