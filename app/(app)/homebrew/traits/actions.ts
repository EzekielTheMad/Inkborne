"use server";

import { revalidatePath } from "next/cache";
import { homebrewTraitVersionSchema, type HomebrewTraitActionState } from "@/lib/homebrew/trait-form";
import { createHomebrewTraitRecord, updateHomebrewTraitRecord } from "@/lib/supabase/homebrew-traits-server";

export async function createHomebrewTrait(_previous: HomebrewTraitActionState, form: FormData): Promise<HomebrewTraitActionState> {
  // DAL authenticates and derives authority. Only its validated row confirms a save.
  const result = await createHomebrewTraitRecord(form);
  if ("status" in result) return result;
  revalidatePath("/homebrew");
  revalidatePath("/library");
  // Return confirmation before client navigation; a lost response retains the draft.
  return { status: "saved", id: result.id };
}
export async function updateHomebrewTrait(_previous: HomebrewTraitActionState, form: FormData): Promise<HomebrewTraitActionState> {
  const ids = form.getAll("id");
  const versions = form.getAll("expected_version");
  const version = versions.length === 1 && typeof versions[0] === "string" && /^\d+$/.test(versions[0])
    ? homebrewTraitVersionSchema.safeParse(Number(versions[0])) : null;
  if (ids.length !== 1 || typeof ids[0] !== "string" || !version?.success) return {
    status: "error", message: "The trait identifier or version is invalid. Reload before saving.",
  };
  const result = await updateHomebrewTraitRecord(ids[0], version.data, form);
  if ("status" in result) return result;
  revalidatePath("/homebrew");
  revalidatePath("/library");
  revalidatePath(`/homebrew/traits/${result.id}/edit`);
  return { status: "saved", id: result.id };
}
