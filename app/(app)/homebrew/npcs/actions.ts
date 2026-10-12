"use server";
import { revalidatePath } from "next/cache";
import { createHomebrewNpcRecord, updateHomebrewNpcRecord } from "@/lib/supabase/homebrew-npcs-server";
import type { NpcActionState } from "@/lib/homebrew/npc-form";
function revalidateSaved(id: string) { revalidatePath("/homebrew"); revalidatePath("/library"); revalidatePath(`/library/${id}`); revalidatePath(`/homebrew/npcs/${id}/edit`); }
export async function createHomebrewNpc(_previous: NpcActionState, form: FormData): Promise<NpcActionState> {
  const state = await createHomebrewNpcRecord(form); if (state.status === "saved") revalidateSaved(state.id); return state;
}
export async function updateHomebrewNpc(_previous: NpcActionState, form: FormData): Promise<NpcActionState> {
  const state = await updateHomebrewNpcRecord(form); if (state.status === "saved") revalidateSaved(state.id); return state;
}
