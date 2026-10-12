"use server";
import { revalidatePath } from "next/cache";
import type { FeatureActionState } from "@/lib/homebrew/passive-feature-form";
import { createHomebrewPassiveFeatureRecord, updateHomebrewPassiveFeatureRecord } from "@/lib/supabase/homebrew-passive-features-server";

function revalidateSaved(id: string) {
  revalidatePath("/homebrew"); revalidatePath("/library"); revalidatePath(`/library/${id}`);
}
export async function createHomebrewPassiveFeature(_previous: FeatureActionState, form: FormData): Promise<FeatureActionState> {
  // DAL authenticates/derives all authority; no form or association claim is trusted.
  const result = await createHomebrewPassiveFeatureRecord(form);
  if (result.status === "saved") revalidateSaved(result.id);
  return result;
}
export async function updateHomebrewPassiveFeature(_previous: FeatureActionState, form: FormData): Promise<FeatureActionState> {
  const result = await updateHomebrewPassiveFeatureRecord(form);
  if (result.status === "saved") { revalidateSaved(result.id); revalidatePath(`/homebrew/features/${result.id}/edit`); }
  // Genuine unchanged results do not revalidate, advance a version or navigate.
  return result;
}
