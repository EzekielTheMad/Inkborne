import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { instanceIntentFromForm } from "@/lib/campaigns/monster-instance-form";
import { CAMPAIGN_MONSTERS_ENABLED, admittedMonsterSnapshot, instanceDetailSchema, instanceSummarySchema,
  parseInstanceActionResponse, sourcePreviewSchema, type InstanceActionResponse, type InstanceDetail, type InstanceSummary } from "@/lib/campaigns/monster-instance-schema";

export async function campaignMonsterContext(campaignId: string) {
  if (!CAMPAIGN_MONSTERS_ENABLED || !z.string().uuid().safeParse(campaignId).success) return null;
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.is_anonymous === true || !z.string().uuid().safeParse(user.id).success) return null;
  const { data: campaign, error: campaignError } = await client.from("campaigns").select("id,name,owner_id,system_id").eq("id", campaignId).eq("owner_id", user.id).maybeSingle();
  const parsed = z.object({ id: z.string().uuid(), name: z.string(), owner_id: z.literal(user.id), system_id: z.string().uuid() }).safeParse(campaign);
  if (campaignError || !parsed.success || parsed.data.id !== campaignId) return null;
  return { client, ownerId: user.id, campaign: parsed.data };
}
async function requirePublishedSourceSystem(ctx: NonNullable<Awaited<ReturnType<typeof campaignMonsterContext>>>) {
  const { data: system, error } = await ctx.client.from("game_systems").select("id").eq("slug", "dnd-5e-2014").eq("status", "published").single();
  if (error || system?.id !== ctx.campaign.system_id) throw new Error("Published source system unavailable.");
}
// PostgreSQL bigint must be returned as decimal text, never rounded JSON numbers.
// Native table revision is bigint; roster/detail use RPC projections below.
export async function listCampaignMonsterInstances(campaignId: string, archived: boolean, search: string, page: number): Promise<InstanceSummary[]> {
  const ctx = await campaignMonsterContext(campaignId);
  if (!ctx) throw new Error("Campaign monster management unavailable.");
  if (search.length > 100 || !Number.isInteger(page) || page < 0 || page > 500) throw new Error("Invalid roster query.");
  const { data, error } = await ctx.client.rpc("list_campaign_monster_instances_v1", { target_campaign_id: campaignId, show_archived: archived, name_search: search, page_number: page });
  if (error || !Array.isArray(data) || data.length > 20) throw new Error("The roster could not be loaded.");
  return data.map((raw) => { const value = instanceSummarySchema.parse(raw); if (value.campaign_id !== campaignId || value.archived !== archived) throw new Error("Unexpected roster identity."); return value; });
}
export async function getCampaignMonsterInstance(campaignId: string, instanceId: string): Promise<InstanceDetail | null> {
  const ctx = await campaignMonsterContext(campaignId);
  if (!ctx || !z.string().uuid().safeParse(instanceId).success) return null;
  const { data, error } = await ctx.client.rpc("get_campaign_monster_instance_v1", { target_campaign_id: campaignId, target_instance_id: instanceId });
  if (error) throw new Error("The instance could not be loaded.");
  if (!data) return null;
  const row = instanceDetailSchema.parse(data);
  if (row.id !== instanceId || row.campaign_id !== campaignId || row.system_id !== ctx.campaign.system_id) throw new Error("Unexpected instance identity.");
  const parsed = admittedMonsterSnapshot(row.source_snapshot, row.system_id, row.source_content_id, row.source_version);
  if (parsed.data.hit_points.average !== row.declared_max_hp) throw new Error("Unsupported source HP.");
  return row;
}
export async function listCampaignMonsterSources(campaignId: string, search = "") {
  const ctx = await campaignMonsterContext(campaignId);
  if (!ctx) throw new Error("Campaign monster management unavailable.");
  if (search.length > 100) throw new Error("Invalid source search.");
  await requirePublishedSourceSystem(ctx);
  const escaped = search.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await ctx.client.from("content_definitions").select("id,name,version").eq("system_id", ctx.campaign.system_id)
    .eq("content_type", "monster").eq("is_retired", false).or(`scope.eq.platform,and(scope.eq.personal,owner_id.eq.${ctx.ownerId})`).ilike("name", `%${escaped}%`).order("name").order("id").limit(100);
  if (error) throw new Error("Monster sources could not be loaded.");
  return z.array(z.object({ id: z.string().uuid(), name: z.string().min(1).max(200), version: z.number().int().min(1).max(2147483647) })).max(100).parse(data ?? []);
}
export async function previewCampaignMonsterSource(campaignId: string, sourceId: string, version: number) {
  const ctx = await campaignMonsterContext(campaignId);
  if (!ctx) throw new Error("Campaign monster management unavailable.");
  if (!z.string().uuid().safeParse(sourceId).success || !Number.isInteger(version) || version < 1 || version > 2147483647) throw new Error("Invalid source identity.");
  await requirePublishedSourceSystem(ctx);
  const { data, error } = await ctx.client.rpc("read_campaign_monster_source_v1", { target_campaign_id: campaignId, target_content_id: sourceId, target_version: version });
  if (error) throw new Error("The source changed or is unsupported. Choose its current version again.");
  const preview = sourcePreviewSchema.parse(data);
  if (preview.source_id !== sourceId || preview.source_version !== version || preview.system_id !== ctx.campaign.system_id) throw new Error("Unexpected source preview.");
  const parsed = admittedMonsterSnapshot(preview.snapshot, preview.system_id, sourceId, version);
  if (parsed.data.hit_points.average !== preview.declared_max_hp) throw new Error("Unsupported source HP.");
  return preview;
}
export async function commitCampaignMonsterInstance(campaignId: string, form: FormData): Promise<InstanceActionResponse> {
  let intent;
  try { intent = instanceIntentFromForm(form); } catch { return { status: "error", message: "Check the instance fields and command size." }; }
  const ctx = await campaignMonsterContext(campaignId);
  if (!ctx) return { status: "error", message: "Campaign monster management unavailable." };
  try {
    const { data, error } = await ctx.client.rpc("commit_campaign_monster_instance_v1", { target_campaign_id: campaignId, request: intent });
    if (error) return { status: error.code === "40001" ? "conflict" : "uncertain", message: error.code === "40001" ? "The source, command or instance changed. Reload latest before a new command." : "The command could not be confirmed. Check campaign monsters." };
    return parseInstanceActionResponse({ status: "saved", receipt: data }, campaignId, intent.operation_id, intent);
  } catch { return { status: "uncertain", message: "The command could not be confirmed. Check campaign monsters." }; }
}
export async function resolveCampaignMonsterInstance(campaignId: string, operationId: string): Promise<InstanceActionResponse> {
  const ctx = await campaignMonsterContext(campaignId);
  if (!ctx || !z.string().uuid().safeParse(operationId).success) return { status: "uncertain", message: "Recovery is unavailable. Retain the original operation." };
  try {
    const { data, error } = await ctx.client.rpc("resolve_campaign_monster_command_v1", { target_campaign_id: campaignId, target_operation_id: operationId });
    if (error) throw new Error("Unconfirmed recovery");
    return parseInstanceActionResponse(data, campaignId, operationId);
  } catch { return { status: "uncertain", message: "Recovery could not be confirmed. Retain the original operation." }; }
}
