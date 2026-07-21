"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewFeatRecord,
  setHomebrewFeatCampaignShare,
  updateHomebrewFeatRecord,
  type HomebrewFeatMutationResult,
} from "@/lib/supabase/homebrew-feats-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewFeatActionState = HomebrewFeatMutationResult;

export type HomebrewFeatShareActionState = HomebrewFeatMutationResult & {
  contentId?: string;
  campaignId?: string;
  enabled?: boolean;
  version?: number;
  scope?: "personal" | "shared";
  sharedCampaignCount?: number;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}

export async function createHomebrewFeat(
  _previousState: HomebrewFeatActionState,
  formData: FormData,
): Promise<HomebrewFeatActionState> {
  await requireUser();
  const result = await createHomebrewFeatRecord(formData);
  if ("status" in result) return result;

  revalidatePath("/library");
  redirect(`/library?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewFeat(
  _previousState: HomebrewFeatActionState,
  formData: FormData,
): Promise<HomebrewFeatActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { status: "error", message: "This feat could not be identified. Reload and try again." };
  }

  const result = await updateHomebrewFeatRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidatePath("/library");
  revalidatePath(`/library/feats/${result.id}/edit`);
  redirect(`/library?updated=${encodeURIComponent(result.id)}`);
}

export async function toggleHomebrewFeatCampaignShare(
  _previousState: HomebrewFeatShareActionState,
  formData: FormData,
): Promise<HomebrewFeatShareActionState> {
  await requireUser();
  const contentId = String(formData.get("content_id") ?? "");
  const campaignId = String(formData.get("campaign_id") ?? "");
  const enabledValue = String(formData.get("enabled") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (
    !contentId
    || !campaignId
    || !["true", "false"].includes(enabledValue)
    || !Number.isInteger(expectedVersion)
    || expectedVersion < 1
  ) {
    return {
      status: "error",
      message: "Campaign access could not be identified. Reload and try again.",
    };
  }

  const enabled = enabledValue === "true";
  const result = await setHomebrewFeatCampaignShare(
    contentId,
    campaignId,
    enabled,
    expectedVersion,
  );
  if ("status" in result) return result;

  revalidatePath("/library");
  revalidatePath(`/library/feats/${result.contentId}/edit`);
  return {
    status: "idle",
    message: enabled ? "Campaign access granted." : "Campaign access removed.",
    contentId: result.contentId,
    campaignId,
    enabled,
    version: result.version,
    scope: result.scope,
    sharedCampaignCount: result.sharedCampaignCount,
  };
}
