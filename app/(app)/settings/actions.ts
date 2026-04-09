"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = formData.get("displayName") as string;
  const bio = formData.get("bio") as string;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, bio: bio || null })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image" };
  }

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    return { error: "File must be less than 2MB" };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  // Append cache-busting timestamp
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true, avatarUrl };
}

export async function updatePreferences(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const theme = formData.get("theme") as string;
  if (!["dark", "light", "system"].includes(theme)) {
    return { error: "Invalid theme value" };
  }

  // Fetch current preferences, merge with new theme
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
  const newPrefs = { ...currentPrefs, theme };

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: newPrefs })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use admin client with service role key to delete the user
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    return { error: error.message };
  }

  // Sign out the current session
  await supabase.auth.signOut();

  redirect("/");
}
