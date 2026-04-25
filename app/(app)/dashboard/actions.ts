"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function dismissAlphaBanner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  if (fetchError) {
    console.error("[dismissAlphaBanner] Fetch error:", fetchError.message);
    return { error: fetchError.message };
  }

  const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
  const newPrefs = { ...currentPrefs, alpha_banner_dismissed_at: new Date().toISOString() };

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: newPrefs })
    .eq("id", user.id);

  if (error) {
    console.error("[dismissAlphaBanner] Update error:", error.message, error.details, error.hint);
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
