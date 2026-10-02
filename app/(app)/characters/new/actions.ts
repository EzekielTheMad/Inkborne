"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createCharacter(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const nameField = formData.get("name");
  const systemField = formData.get("system_id");
  const name = typeof nameField === "string" ? nameField.trim() : "";
  const systemId = typeof systemField === "string" ? systemField.trim() : "";

  if (!name || !systemId) {
    redirect("/characters/new?error=missing_fields");
  }

  let createdId: string | undefined;
  try {
    const { data, error } = await supabase
      .from("characters")
      .insert([{ name, user_id: user.id, system_id: systemId }])
      .select("id")
      .single();
    if (!error) createdId = data?.id;
  } catch {
    // A network failure uses the same recovery path as a rejected insert.
  }

  if (!createdId) {
    redirect("/characters/new?error=creation_failed");
  }

  redirect(`/characters/${createdId}/builder`);
}
