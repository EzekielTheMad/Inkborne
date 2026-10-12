"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHomebrewMonsterRecord, updateHomebrewMonsterRecord } from "@/lib/supabase/homebrew-monsters-server";
import { createClient } from "@/lib/supabase/server";
import type { MonsterFormState } from "@/lib/homebrew/monster-form";
async function requireUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
}
function revalidate(id: string) {
  revalidatePath("/homebrew"); revalidatePath("/library"); revalidatePath(`/library/${id}`);
}
export async function createHomebrewMonster(_state: MonsterFormState, form: FormData): Promise<MonsterFormState> {
  await requireUser();
  const result = await createHomebrewMonsterRecord(form);
  if ("status" in result) return result;
  revalidate(result.id);
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
}
export async function updateHomebrewMonster(_state: MonsterFormState, form: FormData): Promise<MonsterFormState> {
  await requireUser();
  const result = await updateHomebrewMonsterRecord(form);
  if ("status" in result) return result;
  revalidate(result.id); revalidatePath(`/homebrew/monsters/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}
