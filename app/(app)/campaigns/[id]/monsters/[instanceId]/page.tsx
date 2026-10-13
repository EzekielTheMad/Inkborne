import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MonsterInstanceForm } from "@/components/campaigns/monster-instance-form";
import { CAMPAIGN_MONSTERS_ENABLED, instanceDetailSchema, parseInstanceActionResponse } from "@/lib/campaigns/monster-instance-schema";
import { campaignMonsterContext, getCampaignMonsterInstance, resolveCampaignMonsterInstance } from "@/lib/supabase/campaign-monster-instances-server";
// Repository cacheComponents is not enabled; installed Next previous-cache-model guide.
export const dynamic = "force-dynamic";
export default async function CampaignMonsterDetail({ params, searchParams }: {
  params: Promise<{ id: string; instanceId: string }>; searchParams?: Promise<{ editAfter?: string | string[] }>
}) {
  if (!CAMPAIGN_MONSTERS_ENABLED) notFound();
  const { id, instanceId } = await params;
  const ctx = await campaignMonsterContext(id);
  if (!ctx) notFound();
  const query = searchParams ? await searchParams : {};
  const editAfter = query.editAfter;
  let minimumRevision: string | null = null;
  if (editAfter !== undefined) {
    if (typeof editAfter !== "string" || editAfter !== editAfter.toLowerCase() || !z.string().uuid().safeParse(editAfter).success) notFound();
    const response = parseInstanceActionResponse(await resolveCampaignMonsterInstance(id, editAfter), id, editAfter);
    if (response.status !== "saved" || response.receipt.instance_id !== instanceId) throw new Error("Accepted instance operation is unavailable.");
    minimumRevision = response.receipt.readback.revision;
  }
  const initial = await getCampaignMonsterInstance(id, instanceId);
  if (!initial) notFound();
  const checked = instanceDetailSchema.parse(initial);
  if (checked.id !== instanceId || checked.campaign_id !== id || checked.system_id !== ctx.campaign.system_id
    || minimumRevision !== null && BigInt(checked.revision) < BigInt(minimumRevision)) throw new Error("Latest instance revision is unavailable.");
  return <div className="min-w-0 space-y-6"><Link href={`/campaigns/${id}/monsters`}>Back to monster roster</Link>
    <h1 className="j-display text-3xl [overflow-wrap:anywhere]">{initial.name}</h1>
    <MonsterInstanceForm key={`${ctx.ownerId}:${id}:${instanceId}:${editAfter ?? "initial"}`} campaignId={id} ownerId={ctx.ownerId} systemId={ctx.campaign.system_id} initial={checked} />
  </div>;
}
