"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  uploadCharacterImage,
  deleteCharacterImage,
} from "@/lib/supabase/storage";
import type { NarrativeData, NarrativeRichData, PersonalityFields } from "@/lib/types/narrative";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Verify the requesting user owns the given character. Returns the user id on
 *  success, or throws/redirects on auth failure. Returns null if not owner. */
async function getAuthenticatedOwner(characterId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[narrative-actions] Auth check for character:", characterId, "user:", user.id);

  const { data: character, error } = await supabase
    .from("characters")
    .select("id, user_id, narrative, narrative_rich, choices")
    .eq("id", characterId)
    .single();

  if (error || !character) {
    console.error("[narrative-actions] Character not found:", characterId, error?.message);
    return null;
  }

  if (character.user_id !== user.id) {
    console.error("[narrative-actions] Ownership check failed for character:", characterId, "user:", user.id);
    return null;
  }

  return { supabase, user, character };
}

// ---------------------------------------------------------------------------
// saveNarrative
// ---------------------------------------------------------------------------

export async function saveNarrative(
  characterId: string,
  narrativeData: Partial<NarrativeData>,
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAuthenticatedOwner(characterId);
  if (!ctx) return { error: "Not authorized" };

  const { supabase, character } = ctx;

  const current = (character.narrative as NarrativeData) ?? {};
  const merged = { ...current, ...narrativeData };

  console.log("[saveNarrative] Saving narrative for character:", characterId);

  const { error } = await supabase
    .from("characters")
    .update({ narrative: merged })
    .eq("id", characterId);

  if (error) {
    console.error("[saveNarrative] Error:", error.message, error.details, error.hint);
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// saveNarrativeRich
// ---------------------------------------------------------------------------

export async function saveNarrativeRich(
  characterId: string,
  narrativeRichData: Partial<NarrativeRichData>,
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAuthenticatedOwner(characterId);
  if (!ctx) return { error: "Not authorized" };

  const { supabase, character } = ctx;

  const current = (character.narrative_rich as NarrativeRichData) ?? {};
  const merged = { ...current, ...narrativeRichData };

  console.log("[saveNarrativeRich] Saving narrative_rich for character:", characterId);

  const { error } = await supabase
    .from("characters")
    .update({ narrative_rich: merged })
    .eq("id", characterId);

  if (error) {
    console.error("[saveNarrativeRich] Error:", error.message, error.details, error.hint);
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// savePersonalityChoices
// ---------------------------------------------------------------------------

export async function savePersonalityChoices(
  characterId: string,
  fields: PersonalityFields,
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAuthenticatedOwner(characterId);
  if (!ctx) return { error: "Not authorized" };

  const { supabase, character } = ctx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentChoices = (character.choices as Record<string, any>) ?? {};
  const merged = { ...currentChoices, ...fields };

  console.log("[savePersonalityChoices] Saving personality choices for character:", characterId);

  const { error } = await supabase
    .from("characters")
    .update({ choices: merged })
    .eq("id", characterId);

  if (error) {
    console.error("[savePersonalityChoices] Error:", error.message, error.details, error.hint);
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// uploadPortrait
// ---------------------------------------------------------------------------

export async function uploadPortrait(
  characterId: string,
  formData: FormData,
): Promise<{ success: true; url: string } | { error: string }> {
  const ctx = await getAuthenticatedOwner(characterId);
  if (!ctx) return { error: "Not authorized" };

  const file = formData.get("portrait") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file provided" };
  }

  console.log("[uploadPortrait] Uploading portrait for character:", characterId);

  const result = await uploadCharacterImage(characterId, file, "portrait");
  if ("error" in result) return result;

  const { url } = result;

  // Persist the URL into narrative.portrait_url
  const saveResult = await saveNarrative(characterId, { portrait_url: url });
  if ("error" in saveResult) return saveResult;

  return { success: true, url };
}

// ---------------------------------------------------------------------------
// uploadToken
// ---------------------------------------------------------------------------

export async function uploadToken(
  characterId: string,
  formData: FormData,
): Promise<{ success: true; url: string } | { error: string }> {
  const ctx = await getAuthenticatedOwner(characterId);
  if (!ctx) return { error: "Not authorized" };

  const file = formData.get("token") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file provided" };
  }

  console.log("[uploadToken] Uploading token for character:", characterId);

  const result = await uploadCharacterImage(characterId, file, "token");
  if ("error" in result) return result;

  const { url } = result;

  const saveResult = await saveNarrative(characterId, { token_url: url });
  if ("error" in saveResult) return saveResult;

  return { success: true, url };
}

// ---------------------------------------------------------------------------
// deletePortrait
// ---------------------------------------------------------------------------

export async function deletePortrait(
  characterId: string,
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAuthenticatedOwner(characterId);
  if (!ctx) return { error: "Not authorized" };

  console.log("[deletePortrait] Deleting portrait for character:", characterId);

  const deleteResult = await deleteCharacterImage(characterId, "portrait");
  if ("error" in deleteResult) return deleteResult;

  // Clear the URL from narrative
  const saveResult = await saveNarrative(characterId, { portrait_url: undefined });
  if ("error" in saveResult) return saveResult;

  return { success: true };
}

// ---------------------------------------------------------------------------
// deleteToken
// ---------------------------------------------------------------------------

export async function deleteToken(
  characterId: string,
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAuthenticatedOwner(characterId);
  if (!ctx) return { error: "Not authorized" };

  console.log("[deleteToken] Deleting token for character:", characterId);

  const deleteResult = await deleteCharacterImage(characterId, "token");
  if ("error" in deleteResult) return deleteResult;

  const saveResult = await saveNarrative(characterId, { token_url: undefined });
  if ("error" in saveResult) return saveResult;

  return { success: true };
}
