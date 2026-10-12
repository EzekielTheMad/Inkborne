"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewItemRecord,
  updateHomebrewItemRecord,
  setHomebrewItemCampaignShare,
  type HomebrewItemShareFailure,
  type HomebrewItemMutationResult,
} from "@/lib/supabase/homebrew-items-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewItemActionState = HomebrewItemMutationResult;
export type HomebrewItemShareActionState = {
  status: "idle" | HomebrewItemShareFailure["status"];
  message: string;
  contentId?: string;
  campaignId?: string;
  enabled?: boolean;
  version?: number;
  scope?: "personal" | "shared";
  sharedCampaignCount?: number;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
}

function revalidateHomebrewCatalog() {
  revalidatePath("/homebrew");
  revalidatePath("/library");
}

export async function createHomebrewItem(
  _previousState: HomebrewItemActionState,
  formData: FormData,
): Promise<HomebrewItemActionState> {
  await requireUser();
  const result = await createHomebrewItemRecord(formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewItem(
  _previousState: HomebrewItemActionState,
  formData: FormData,
): Promise<HomebrewItemActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      status: "error",
      message: "This item could not be identified. Reload and try again.",
    };
  }

  const result = await updateHomebrewItemRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/items/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}

export async function toggleHomebrewItemCampaignShare(previous: HomebrewItemShareActionState, formData: FormData): Promise<HomebrewItemShareActionState> {
  await requireUser();
  // Display state prevents accidental repeated submissions. Caller-supplied
  // previous state is not authentication; permissions/CAS belong to the RPC.
  if (previous.status === "uncertain" || previous.status === "conflict") return previous;
  const contentId = String(formData.get("content_id") ?? ""), campaignId = String(formData.get("campaign_id") ?? "");
  const rawEnabled = String(formData.get("enabled") ?? ""), expectedVersion = Number(formData.get("expected_version"));
  if (!contentId || !campaignId || !["true", "false"].includes(rawEnabled) || !Number.isInteger(expectedVersion) || expectedVersion < 1 || expectedVersion > 2147483647) {
    return { status: "error", message: "Campaign access could not be identified. Reload latest access." };
  }
  const enabled = rawEnabled === "true";
  const result = await setHomebrewItemCampaignShare(contentId, campaignId, enabled, expectedVersion);
  if ("status" in result) return { ...result, contentId, campaignId, enabled };
  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/items/${result.contentId}/edit`);
  revalidatePath(`/campaigns/${campaignId}/settings`);
  return { status: "idle", message: enabled ? "Campaign access granted." : "Campaign access removed.",
    ...result, campaignId, enabled };
}
