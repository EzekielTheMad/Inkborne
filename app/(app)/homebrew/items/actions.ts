"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewItemRecord,
  updateHomebrewItemRecord,
  type HomebrewItemMutationResult,
} from "@/lib/supabase/homebrew-items-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewItemActionState = HomebrewItemMutationResult;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
}

function revalidateHomebrewCatalog() {
  revalidatePath("/homebrew");
  revalidatePath("/library");
}

export async function createHomebrewItem(
  _previousState: HomebrewItemActionState,
  formData: FormData,
): Promise<HomebrewItemActionState> {
  await requireUser();
  const result = await createHomebrewItemRecord(formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewItem(
  _previousState: HomebrewItemActionState,
  formData: FormData,
): Promise<HomebrewItemActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      status: "error",
      message: "This item could not be identified. Reload and try again.",
    };
  }

  const result = await updateHomebrewItemRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/items/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}
