"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { acceptMagicItemResponse, magicItemUncertainty, mapMagicItemEditIdentity, type MagicItemActionState } from "@/lib/homebrew/magic-item-form";
import { createHomebrewMagicItemRecord, updateHomebrewMagicItemRecord } from "@/lib/supabase/homebrew-magic-items-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewMagicItemActionState = MagicItemActionState;
async function requireUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !z.uuid().safeParse(user.id).success) redirect("/login");
}
function refreshSaved(state: MagicItemActionState): MagicItemActionState {
  if (state.status !== "saved") return state;
  try {
    revalidatePath("/homebrew"); revalidatePath("/library");
    if (state.operation === "edit") revalidatePath(`/homebrew/magic-items/${state.id}/edit`);
  } catch (error) {
    unstable_rethrow(error);
    return { ...state, message: "The exact saved version is confirmed, but the catalog refresh failed. Check Homebrew; do not repeat this save." };
  }
  return state;
}
export async function createHomebrewMagicItem(_previous: MagicItemActionState, form: FormData): Promise<MagicItemActionState> {
  await requireUser();
  let state: MagicItemActionState;
  try { state = acceptMagicItemResponse(await createHomebrewMagicItemRecord(form), "create"); }
  catch (error) { unstable_rethrow(error); return magicItemUncertainty("create"); }
  return refreshSaved(state);
}
export async function updateHomebrewMagicItem(_previous: MagicItemActionState, form: FormData): Promise<MagicItemActionState> {
  await requireUser();
  const identity = mapMagicItemEditIdentity(form);
  if (!identity) return { status: "error", message: "This magic item could not be identified. Reload before saving.", fieldErrors: { form: ["Invalid identifier or expected version."] } };
  let state: MagicItemActionState;
  try { state = acceptMagicItemResponse(await updateHomebrewMagicItemRecord(identity.id, identity.expectedVersion, form), "edit", identity.id, identity.expectedVersion); }
  catch (error) { unstable_rethrow(error); return magicItemUncertainty("edit"); }
  return refreshSaved(state);
}
