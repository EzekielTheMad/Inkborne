"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { commitCampaignMonsterInstance, previewCampaignMonsterSource, resolveCampaignMonsterInstance } from "@/lib/supabase/campaign-monster-instances-server";

export async function commitCampaignMonster(campaignId: string, form: FormData) {
  const result = await commitCampaignMonsterInstance(campaignId, form);
  if (result.status === "saved") {
    try { revalidatePath(`/campaigns/${campaignId}/monsters`); }
    catch (error) { unstable_rethrow(error); /* Accepted receipt survives ordinary cache failure. */ }
  }
  return result;
}
export async function resolveCampaignMonster(campaignId: string, operationId: string) {
  return resolveCampaignMonsterInstance(campaignId, operationId);
}
export async function previewCampaignMonster(campaignId: string, sourceId: string, version: number) {
  try { return { status: "preview" as const, preview: await previewCampaignMonsterSource(campaignId, sourceId, version) }; }
  catch (error) { unstable_rethrow(error); return { status: "error" as const, message: "The source changed or is unsupported. Choose a current supported monster." }; }
}
