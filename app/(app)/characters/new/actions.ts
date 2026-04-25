"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createCharacter(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name = formData.get("name") as string | null;
  const systemId = formData.get("system_id") as string | null;

  if (!name?.trim() || !systemId) {
    console.error("[createCharacter] Missing fields:", { name, systemId });
    redirect("/characters/new?error=missing_fields");
  }

  console.log("[createCharacter] Inserting character:", {
    name: name.trim(),
    user_id: user.id,
    system_id: systemId,
  });

  const { data, error } = await supabase
    .from("characters")
    .insert([
      {
        name: name.trim(),
        user_id: user.id,
        system_id: systemId,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("[createCharacter] Insert failed:", error.message, error.details, error.hint);
    redirect(`/characters/new?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/characters/${data.id}/builder`);
}
