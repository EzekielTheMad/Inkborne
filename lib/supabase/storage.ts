import { createClient } from "@/lib/supabase/server";

const BUCKET = "character-portraits";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload a portrait or token image for a character.
 * Uploads to: character-portraits/{characterId}/{type}.{ext}
 * Uses upsert to replace any existing file at that path.
 * Returns the public URL with a cache-busting timestamp.
 */
export async function uploadCharacterImage(
  characterId: string,
  file: File,
  type: "portrait" | "token",
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "File must be a JPEG, PNG, or WebP image" };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { error: "File must be less than 5MB" };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${characterId}/${type}.${ext}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("[uploadCharacterImage] Upload error:", uploadError.message);
    return { error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  const url = `${publicUrl}?t=${Date.now()}`;
  return { url };
}

/**
 * Delete a portrait or token image for a character.
 * Lists files matching {characterId}/{type}.* and removes the first match.
 */
export async function deleteCharacterImage(
  characterId: string,
  type: "portrait" | "token",
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(characterId);

  if (listError) {
    console.error("[deleteCharacterImage] List error:", listError.message);
    return { error: listError.message };
  }

  const match = files?.find((f) => f.name.startsWith(`${type}.`));
  if (!match) {
    // Nothing to delete — treat as success
    return { success: true };
  }

  const filePath = `${characterId}/${match.name}`;
  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (removeError) {
    console.error("[deleteCharacterImage] Remove error:", removeError.message);
    return { error: removeError.message };
  }

  return { success: true };
}

/**
 * Construct the public URL for a character image.
 * This is a pure utility — the canonical URL is stored in narrative.portrait_url
 * or narrative.token_url. Use this only when you need to derive the URL from
 * the storage path without fetching narrative data.
 */
export function getCharacterImageUrl(
  characterId: string,
  type: "portrait" | "token",
  ext = "jpg",
): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${characterId}/${type}.${ext}`;
}
