import Link from "next/link";
import { notFound } from "next/navigation";
import { MonsterInstanceForm } from "@/components/campaigns/monster-instance-form";
import { CAMPAIGN_MONSTERS_ENABLED } from "@/lib/campaigns/monster-instance-schema";
import { campaignMonsterContext, getCampaignMonsterInstance } from "@/lib/supabase/campaign-monster-instances-server";
export default async function CampaignMonsterDetail({ params }: { params: Promise<{ id: string; instanceId: string }> }) {
  if (!CAMPAIGN_MONSTERS_ENABLED) notFound();
  const { id, instanceId } = await params;
  const ctx = await campaignMonsterContext(id);
  if (!ctx) notFound();
  const initial = await getCampaignMonsterInstance(id, instanceId);
  if (!initial) notFound();
  return <div className="min-w-0 space-y-6"><Link href={`/campaigns/${id}/monsters`}>Back to monster roster</Link>
    <h1 className="j-display text-3xl [overflow-wrap:anywhere]">{initial.name}</h1>
    <MonsterInstanceForm key={`${ctx.ownerId}:${id}:${instanceId}`} campaignId={id} ownerId={ctx.ownerId} initial={initial} />
  </div>;
}
