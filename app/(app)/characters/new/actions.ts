"use server";

import { createClient } from "@/lib/supabase/server";
import { createStartingEquipmentClient, startingEquipmentEnabled } from "@/lib/supabase/starting-equipment-server";
import { redirect } from "next/navigation";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";

export async function createCharacter(formData: FormData) {
  // Once the staged path is selected, an old tab may not bypass it through
  // the legacy INSERT or starting-equipment RPC after an uncertain result.
  if (characterCreationUIEnabled()) redirect("/characters/new?error=creation_failed");
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const nameField = formData.get("name");
  const systemField = formData.get("system_id");
  const name = typeof nameField === "string" ? nameField.trim() : "";
  const systemId = typeof systemField === "string" ? systemField.trim() : "";

  if (!name || !systemId) {
    redirect("/characters/new?error=missing_fields");
  }

  let createdId: string | undefined;
  try {
    if (startingEquipmentEnabled()) {
      const { data, error } = await createStartingEquipmentClient().rpc("create_character_with_starting_grant", {
        actor_id: user.id, character_name: name, target_system_id: systemId,
      });
      if (!error && typeof data === "string") createdId = data;
      // Never fall back after a failed/ambiguous transaction response.
    } else {
      const { data, error } = await supabase
        .from("characters")
        .insert([{ name, user_id: user.id, system_id: systemId }])
        .select("id")
        .single();
      if (!error) createdId = data?.id;
    }
  } catch {
    // A network failure uses the same recovery path as a rejected insert.
  }

  if (!createdId) {
    redirect("/characters/new?error=creation_failed");
  }

  redirect(`/characters/${createdId}/builder`);
}
