"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewWeaponRecord,
  updateHomebrewWeaponRecord,
  type HomebrewWeaponMutationResult,
} from "@/lib/supabase/homebrew-weapons-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewWeaponActionState = HomebrewWeaponMutationResult;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
}

function revalidateHomebrewCatalog() {
  revalidatePath("/homebrew");
  revalidatePath("/library");
}

export async function createHomebrewWeapon(
  _previousState: HomebrewWeaponActionState,
  formData: FormData,
): Promise<HomebrewWeaponActionState> {
  await requireUser();
  const result = await createHomebrewWeaponRecord(formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewWeapon(
  _previousState: HomebrewWeaponActionState,
  formData: FormData,
): Promise<HomebrewWeaponActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      status: "error",
      message: "This weapon could not be identified. Reload and try again.",
    };
  }

  const result = await updateHomebrewWeaponRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/weapons/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}
