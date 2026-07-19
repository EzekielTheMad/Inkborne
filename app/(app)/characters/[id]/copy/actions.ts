"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { reportServerError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

const copyCharacterInput = z.object({
  sourceCharacterId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  campaignId: z.union([z.string().uuid(), z.literal("")]),
});

export async function copyCharacter(formData: FormData): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = copyCharacterInput.safeParse({
    sourceCharacterId: formData.get("source_character_id"),
    name: formData.get("name"),
    campaignId: formData.get("campaign_id") ?? "",
  });

  if (!parsed.success) {
    const sourceId = String(formData.get("source_character_id") ?? "");
    redirect(`/characters/${encodeURIComponent(sourceId)}/copy?error=invalid_input`);
  }

  const { data: copiedCharacterId, error } = await supabase.rpc(
    "copy_character",
    {
      source_character_id: parsed.data.sourceCharacterId,
      target_campaign_id: parsed.data.campaignId || null,
      copied_name: parsed.data.name,
    },
  );

  if (error || !copiedCharacterId) {
    const copyError = error ?? new Error("Copy RPC returned no character id");
    console.error("[copyCharacter] Copy failed:", copyError);
    await reportServerError({
      source: "manual",
      message: copyError.message,
      userId: user.id,
      context: {
        characterId: parsed.data.sourceCharacterId,
        operation: "copy_character",
      },
    });
    redirect(
      `/characters/${parsed.data.sourceCharacterId}/copy?error=copy_failed`,
    );
  }

  revalidatePath("/characters");
  redirect(`/characters/${copiedCharacterId}`);
}

