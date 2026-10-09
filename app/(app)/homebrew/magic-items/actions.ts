"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewMagicItemRecord,
  updateHomebrewMagicItemRecord,
  type HomebrewMagicItemMutationResult,
} from "@/lib/supabase/homebrew-magic-items-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewMagicItemActionState = HomebrewMagicItemMutationResult;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}

function revalidateHomebrewCatalog() {
  revalidatePath("/homebrew");
  revalidatePath("/library");
}

export async function createHomebrewMagicItem(
  _previousState: HomebrewMagicItemActionState,
  formData: FormData,
): Promise<HomebrewMagicItemActionState> {
  await requireUser();
  const result = await createHomebrewMagicItemRecord(formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewMagicItem(
  _previousState: HomebrewMagicItemActionState,
  formData: FormData,
): Promise<HomebrewMagicItemActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      status: "error",
      message: "This magic item could not be identified. Reload and try again.",
    };
  }

  const result = await updateHomebrewMagicItemRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/magic-items/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}
