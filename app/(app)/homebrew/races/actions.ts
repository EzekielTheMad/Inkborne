"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewRaceRecord,
  updateHomebrewRaceRecord,
  type HomebrewRaceMutationResult,
} from "@/lib/supabase/homebrew-races-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewRaceActionState = HomebrewRaceMutationResult;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
}

function revalidateHomebrewCatalog() {
  revalidatePath("/homebrew");
  revalidatePath("/library");
}

export async function createHomebrewRace(
  _previousState: HomebrewRaceActionState,
  formData: FormData,
): Promise<HomebrewRaceActionState> {
  await requireUser();
  const result = await createHomebrewRaceRecord(formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewRace(
  _previousState: HomebrewRaceActionState,
  formData: FormData,
): Promise<HomebrewRaceActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      status: "error",
      message: "This race could not be identified. Reload and try again.",
    };
  }

  const result = await updateHomebrewRaceRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/races/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}
