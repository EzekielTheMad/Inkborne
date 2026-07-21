import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const campaignSharedContentRowSchema = z.object({
  content_id: z.string().uuid(),
  name: z.string().min(1),
  content_type: z.enum(["spell", "feat"]),
  version: z.number().int().positive(),
  source: z.string().min(1),
  scope: z.literal("shared"),
  owner_id: z.string().uuid(),
});

export interface CampaignSharedContent {
  contentId: string;
  name: string;
  contentType: "spell" | "feat";
  version: number;
  source: string;
  scope: "shared";
  ownerId: string;
}

export async function listCampaignSharedContentForOwner(
  campaignId: string,
): Promise<CampaignSharedContent[]> {
  const parsedCampaignId = z.string().uuid().safeParse(campaignId);
  if (!parsedCampaignId.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_campaign_shared_content_for_owner",
    { target_campaign_id: parsedCampaignId.data },
  );
  if (error) throw error;

  const rows = z.array(campaignSharedContentRowSchema).parse(data ?? []);
  return rows.map((parsed) => {
    return {
      contentId: parsed.content_id,
      name: parsed.name,
      contentType: parsed.content_type,
      version: parsed.version,
      source: parsed.source,
      scope: parsed.scope,
      ownerId: parsed.owner_id,
    };
  });
}
