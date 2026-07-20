"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";
import { reportServerError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { normalizeRichTextContent } from "@/lib/editor/content";

const createCampaignInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000),
  systemId: z.string().uuid(),
});

const createPageInput = z.object({
  campaignId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  visibility: z.enum(["campaign", "dm_only"]),
  parentId: z.union([z.string().uuid(), z.literal("")]),
});

const updatePageInput = z.object({
  campaignId: z.string().uuid(),
  pageId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  visibility: z.enum(["campaign", "dm_only"]),
  revision: z.coerce.number().int().positive(),
  content: z.string().transform((value, context) => {
    try {
      return normalizeRichTextContent(JSON.parse(value)) as Json;
    } catch {
      context.addIssue({ code: "custom", message: "Invalid page content" });
      return z.NEVER;
    }
  }),
});

const campaignIdInput = z.object({ campaignId: z.string().uuid() });

const updateCampaignInput = campaignIdInput.extend({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000),
});

const campaignCharacterInput = campaignIdInput.extend({
  characterId: z.string().uuid(),
});

const removeMemberInput = campaignIdInput.extend({
  memberUserId: z.string().uuid(),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createCampaign(formData: FormData): Promise<never> {
  const { supabase, user } = await authenticatedClient();
  const parsed = createCampaignInput.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    systemId: formData.get("system_id"),
  });

  if (!parsed.success) redirect("/campaigns/new?error=invalid_input");

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      owner_id: user.id,
      system_id: parsed.data.systemId,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .select("id")
    .single();

  if (error || !data) {
    await reportServerError({
      source: "server_action",
      message: error?.message ?? "Campaign insert returned no row",
      userId: user.id,
      context: { operation: "create_campaign" },
    });
    redirect("/campaigns/new?error=create_failed");
  }

  revalidatePath("/campaigns");
  redirect(`/campaigns/${data.id}`);
}

export async function joinCampaign(formData: FormData): Promise<never> {
  const { supabase, user } = await authenticatedClient();
  const inviteCode = String(formData.get("invite_code") ?? "").trim();
  if (!/^[a-f0-9]{12,64}$/i.test(inviteCode)) {
    redirect("/campaigns?error=invalid_invite");
  }

  const { data: campaignId, error } = await supabase.rpc(
    "join_campaign_by_invite_code",
    { provided_invite_code: inviteCode },
  );

  if (error || !campaignId) {
    if (error) {
      await reportServerError({
        source: "server_action",
        message: error.message,
        userId: user.id,
        context: { operation: "join_campaign" },
      });
    }
    redirect("/campaigns?error=invite_not_found");
  }

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaignId}`);
}

export async function updateCampaign(formData: FormData): Promise<never> {
  const { supabase, user } = await authenticatedClient();
  const parsed = updateCampaignInput.safeParse({
    campaignId: formData.get("campaign_id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) redirect("/campaigns?error=invalid_campaign");

  const { data: updatedCampaign, error } = await supabase
    .from("campaigns")
    .update({ name: parsed.data.name, description: parsed.data.description })
    .eq("id", parsed.data.campaignId)
    .eq("owner_id", user.id)
    .select("id")
    .single();

  if (error || !updatedCampaign) {
    await reportServerError({
      source: "server_action",
      message: error?.message ?? "Campaign update returned no row",
      userId: user.id,
      context: { operation: "update_campaign", campaignId: parsed.data.campaignId },
    });
    redirect(`/campaigns/${parsed.data.campaignId}/settings?error=update_failed`);
  }

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  redirect(`/campaigns/${parsed.data.campaignId}/settings?saved=1`);
}

export async function rotateCampaignInvite(formData: FormData): Promise<never> {
  const { supabase, user } = await authenticatedClient();
  const parsed = campaignIdInput.safeParse({ campaignId: formData.get("campaign_id") });
  if (!parsed.success) redirect("/campaigns");

  const { error } = await supabase.rpc("rotate_campaign_invite_code", {
    target_campaign_id: parsed.data.campaignId,
  });
  if (error) {
    await reportServerError({
      source: "server_action",
      message: error.message,
      userId: user.id,
      context: { operation: "rotate_campaign_invite", campaignId: parsed.data.campaignId },
    });
    redirect(`/campaigns/${parsed.data.campaignId}/settings?error=rotate_failed`);
  }

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  redirect(`/campaigns/${parsed.data.campaignId}/settings?rotated=1`);
}

export async function assignCharacterToCampaign(formData: FormData): Promise<never> {
  const { supabase, user } = await authenticatedClient();
  const parsed = campaignCharacterInput.safeParse({
    campaignId: formData.get("campaign_id"),
    characterId: formData.get("character_id"),
  });
  if (!parsed.success) redirect("/campaigns?error=invalid_character");

  const { data: assignedCharacter, error } = await supabase
    .from("characters")
    .update({ campaign_id: parsed.data.campaignId })
    .eq("id", parsed.data.characterId)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error || !assignedCharacter) {
    await reportServerError({
      source: "server_action",
      message: error?.message ?? "Character assignment returned no row",
      userId: user.id,
      context: {
        operation: "assign_character_to_campaign",
        campaignId: parsed.data.campaignId,
        characterId: parsed.data.characterId,
      },
    });
    redirect(`/campaigns/${parsed.data.campaignId}?error=assign_failed`);
  }

  revalidatePath("/characters");
  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  redirect(`/campaigns/${parsed.data.campaignId}`);
}

export async function unassignCharacterFromCampaign(formData: FormData): Promise<never> {
  const { supabase, user } = await authenticatedClient();
  const parsed = campaignCharacterInput.safeParse({
    campaignId: formData.get("campaign_id"),
    characterId: formData.get("character_id"),
  });
  if (!parsed.success) redirect("/campaigns");

  const { data: unassignedCharacter, error } = await supabase
    .from("characters")
    .update({ campaign_id: null })
    .eq("id", parsed.data.characterId)
    .eq("user_id", user.id)
    .eq("campaign_id", parsed.data.campaignId)
    .select("id")
    .single();
  if (error || !unassignedCharacter) {
    redirect(`/campaigns/${parsed.data.campaignId}?error=unassign_failed`);
  }

  revalidatePath("/characters");
  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  redirect(`/campaigns/${parsed.data.campaignId}`);
}

export async function leaveCampaign(formData: FormData): Promise<never> {
  const { supabase } = await authenticatedClient();
  const parsed = campaignIdInput.safeParse({ campaignId: formData.get("campaign_id") });
  if (!parsed.success) redirect("/campaigns");

  const { error } = await supabase.rpc("leave_campaign", {
    target_campaign_id: parsed.data.campaignId,
  });
  if (error) redirect(`/campaigns/${parsed.data.campaignId}?error=leave_failed`);

  revalidatePath("/campaigns");
  revalidatePath("/characters");
  redirect("/campaigns");
}

export async function removeCampaignMember(formData: FormData): Promise<never> {
  const { supabase } = await authenticatedClient();
  const parsed = removeMemberInput.safeParse({
    campaignId: formData.get("campaign_id"),
    memberUserId: formData.get("member_user_id"),
  });
  if (!parsed.success) redirect("/campaigns");

  const { error } = await supabase.rpc("remove_campaign_member", {
    target_campaign_id: parsed.data.campaignId,
    target_user_id: parsed.data.memberUserId,
  });
  if (error) {
    redirect(`/campaigns/${parsed.data.campaignId}/settings?error=remove_failed`);
  }

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  redirect(`/campaigns/${parsed.data.campaignId}/settings`);
}

export async function createCampaignPage(formData: FormData): Promise<never> {
  const { supabase, user } = await authenticatedClient();
  const parsed = createPageInput.safeParse({
    campaignId: formData.get("campaign_id"),
    title: formData.get("title"),
    visibility: formData.get("visibility"),
    parentId: formData.get("parent_id") ?? "",
  });

  if (!parsed.success) {
    const campaignId = encodeURIComponent(String(formData.get("campaign_id") ?? ""));
    redirect(`/campaigns/${campaignId}/pages/new?error=invalid_input`);
  }

  const { data: pageId, error } = await supabase.rpc("create_campaign_page", {
    target_campaign_id: parsed.data.campaignId,
    page_title: parsed.data.title,
    page_visibility: parsed.data.visibility,
    parent_page_id: parsed.data.parentId || null,
  });

  if (error || !pageId) {
    await reportServerError({
      source: "server_action",
      message: error?.message ?? "Page RPC returned no id",
      userId: user.id,
      context: {
        operation: "create_campaign_page",
        campaignId: parsed.data.campaignId,
      },
    });
    redirect(`/campaigns/${parsed.data.campaignId}/pages/new?error=create_failed`);
  }

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  redirect(`/campaigns/${parsed.data.campaignId}/pages/${pageId}`);
}

export interface UpdateCampaignPageState {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
  revision: number;
}

export async function updateCampaignPage(
  previousState: UpdateCampaignPageState,
  formData: FormData,
): Promise<UpdateCampaignPageState> {
  const { supabase, user } = await authenticatedClient();
  const parsed = updatePageInput.safeParse({
    campaignId: formData.get("campaign_id"),
    pageId: formData.get("page_id"),
    title: formData.get("title"),
    visibility: formData.get("visibility"),
    revision: formData.get("revision"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      ...previousState,
      status: "error",
      message: "Check the title and page content, then try again.",
    };
  }

  const { data: revision, error } = await supabase.rpc("update_campaign_page", {
    target_page_id: parsed.data.pageId,
    expected_revision: parsed.data.revision,
    page_title: parsed.data.title,
    page_content: parsed.data.content,
    page_visibility: parsed.data.visibility,
  });

  if (error || revision == null) {
    if (error?.code === "40001") {
      return {
        ...previousState,
        status: "conflict",
        message: "This page changed in another session. Reload before saving again.",
      };
    }

    await reportServerError({
      source: "server_action",
      message: error?.message ?? "Page update RPC returned no revision",
      userId: user.id,
      context: {
        operation: "update_campaign_page",
        campaignId: parsed.data.campaignId,
        pageId: parsed.data.pageId,
      },
    });
    return {
      ...previousState,
      status: "error",
      message: "The page could not be saved. Your edits are still here to retry.",
    };
  }

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  revalidatePath(`/campaigns/${parsed.data.campaignId}/pages/${parsed.data.pageId}`);
  return {
    status: "success",
    message: "Page saved.",
    revision,
  };
}
