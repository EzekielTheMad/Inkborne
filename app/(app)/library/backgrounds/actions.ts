"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewBackgroundRecord,
  setHomebrewBackgroundCampaignShare,
  updateHomebrewBackgroundRecord,
  type HomebrewBackgroundMutationResult,
} from "@/lib/supabase/homebrew-backgrounds-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewBackgroundActionState = HomebrewBackgroundMutationResult;

export type HomebrewBackgroundShareActionState = HomebrewBackgroundMutationResult & {
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

export async function createHomebrewBackground(
  _previousState: HomebrewBackgroundActionState,
  formData: FormData,
): Promise<HomebrewBackgroundActionState> {
  await requireUser();
  const result = await createHomebrewBackgroundRecord(formData);
  if ("status" in result) return result;

  revalidatePath("/library");
  redirect(`/library?created=${encodeURIComponent(result.id)}`);
}

export async function updateHomebrewBackground(
  _previousState: HomebrewBackgroundActionState,
  formData: FormData,
): Promise<HomebrewBackgroundActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const expectedVersion = Number(formData.get("expected_version"));
  if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      status: "error",
      message: "This background could not be identified. Reload and try again.",
    };
  }

  const result = await updateHomebrewBackgroundRecord(id, expectedVersion, formData);
  if ("status" in result) return result;

  revalidatePath("/library");
  revalidatePath(`/library/backgrounds/${result.id}/edit`);
  redirect(`/library?updated=${encodeURIComponent(result.id)}`);
}

export async function toggleHomebrewBackgroundCampaignShare(
  _previousState: HomebrewBackgroundShareActionState,
  formData: FormData,
): Promise<HomebrewBackgroundShareActionState> {
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
  const result = await setHomebrewBackgroundCampaignShare(
    contentId,
    campaignId,
    enabled,
    expectedVersion,
  );
  if ("status" in result) return result;

  revalidatePath("/library");
  revalidatePath(`/library/backgrounds/${result.contentId}/edit`);
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
