"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewSpellRecord,
  updateHomebrewSpellRecord,
  type HomebrewSpellMutationResult,
} from "@/lib/supabase/homebrew-spells-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewSpellActionState = HomebrewSpellMutationResult;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}

export async function createHomebrewSpell(
  _previousState: HomebrewSpellActionState,
  formData: FormData,
): Promise<HomebrewSpellActionState> {
  await requireUser();
  const result = await createHomebrewSpellRecord(formData);
  if ("status" in result) return result;

  revalidatePath("/library");
  redirect(`/library?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewSpell(
  _previousState: HomebrewSpellActionState,
  formData: FormData,
): Promise<HomebrewSpellActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { status: "error", message: "This spell could not be identified. Reload and try again." };
  }

  const result = await updateHomebrewSpellRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidatePath("/library");
  revalidatePath(`/library/spells/${result.id}/edit`);
  redirect(`/library?updated=${encodeURIComponent(result.id)}`);
}
