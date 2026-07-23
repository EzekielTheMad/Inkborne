"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createHomebrewSpellRecord,
  setHomebrewSpellCampaignShare,
  updateHomebrewSpellRecord,
  type HomebrewSpellMutationResult,
} from "@/lib/supabase/homebrew-spells-server";
import { createClient } from "@/lib/supabase/server";

export type HomebrewSpellActionState = HomebrewSpellMutationResult;

export type HomebrewSpellShareActionState = HomebrewSpellMutationResult & {
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

function revalidateHomebrewCatalog() {
  revalidatePath("/homebrew");
  revalidatePath("/library");
}

export async function createHomebrewSpell(
  _previousState: HomebrewSpellActionState,
  formData: FormData,
): Promise<HomebrewSpellActionState> {
  await requireUser();
  const result = await createHomebrewSpellRecord(formData);
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  redirect(`/homebrew?created=${encodeURIComponent(result.id)}`);
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

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/spells/${result.id}/edit`);
  redirect(`/homebrew?updated=${encodeURIComponent(result.id)}`);
}

export async function toggleHomebrewSpellCampaignShare(
  _previousState: HomebrewSpellShareActionState,
  formData: FormData,
): Promise<HomebrewSpellShareActionState> {
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
  const result = await setHomebrewSpellCampaignShare(
    contentId,
    campaignId,
    enabled,
    expectedVersion,
  );
  if ("status" in result) return result;

  revalidateHomebrewCatalog();
  revalidatePath(`/homebrew/spells/${result.contentId}/edit`);
  return {
    status: "idle",
    message: enabled
      ? "Campaign access granted."
      : "Campaign access removed.",
    contentId: result.contentId,
    campaignId,
    enabled,
    version: result.version,
    scope: result.scope,
    sharedCampaignCount: result.sharedCampaignCount,
  };
}
