"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewArmorRecord,
  updateHomebrewArmorRecord,
  type HomebrewArmorMutationResult,
} from "@/lib/supabase/homebrew-armors-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewArmorActionState = HomebrewArmorMutationResult;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
}

function revalidateHomebrewCatalog() {
  revalidatePath("/homebrew");
  revalidatePath("/library");
}

export async function createHomebrewArmor(
  _previousState: HomebrewArmorActionState,
  formData: FormData,
): Promise<HomebrewArmorActionState> {
  await requireUser();
  const result = await createHomebrewArmorRecord(formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewArmor(
  _previousState: HomebrewArmorActionState,
  formData: FormData,
): Promise<HomebrewArmorActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      status: "error",
      message: "This armor could not be identified. Reload and try again.",
    };
  }

  const result = await updateHomebrewArmorRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/armors/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}
