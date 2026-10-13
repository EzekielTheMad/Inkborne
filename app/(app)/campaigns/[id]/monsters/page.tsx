import Link from "next/link";
import { notFound } from "next/navigation";
import { MonsterInstancePanel } from "@/components/campaigns/monster-instance-panel";
import { MonsterInstanceForm } from "@/components/campaigns/monster-instance-form";
import { CAMPAIGN_MONSTERS_ENABLED } from "@/lib/campaigns/monster-instance-schema";
import { campaignMonsterContext, listCampaignMonsterInstances, listCampaignMonsterSources } from "@/lib/supabase/campaign-monster-instances-server";

export default async function CampaignMonstersPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; archived?: string; page?: string; sourceSearch?: string }>
}) {
  if (!CAMPAIGN_MONSTERS_ENABLED) notFound();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const ctx = await campaignMonsterContext(id);
  if (!ctx) notFound();
  const search = typeof query.q === "string" ? query.q : "";
  const sourceSearch = typeof query.sourceSearch === "string" ? query.sourceSearch : "";
  const archived = query.archived === "true";
  const page = query.page === undefined ? 0 : /^(0|[1-9][0-9]{0,2})$/.test(query.page) ? Number(query.page) : NaN;
  if (!Number.isInteger(page) || page > 500 || search.length > 100 || sourceSearch.length > 100) notFound();
  const [roster, sourceResult] = await Promise.allSettled([listCampaignMonsterInstances(id, archived, search, page), listCampaignMonsterSources(id, sourceSearch)]);
  if (roster.status !== "fulfilled") throw new Error("The monster roster is unavailable.");
  const rows = roster.value;
  const sources = sourceResult.status === "fulfilled" ? sourceResult.value : [];
  const paging = (next: number) => `/campaigns/${id}/monsters?${new URLSearchParams({ q: search, archived: String(archived), page: String(next), sourceSearch }).toString()}`;
  return <div className="min-w-0 space-y-6">
    <Link href={`/campaigns/${id}`}>Back to campaign</Link>
    <h1 className="j-display text-3xl">{ctx.campaign.name} · Monsters</h1>
    <p>Only the current campaign owner can read these instances and DM notes.</p>
    <form className="flex flex-wrap gap-3">
      <label>Instance name <input name="q" defaultValue={search} maxLength={100} className="rounded border p-2" /></label>
      <label>Roster <select name="archived" defaultValue={String(archived)} className="rounded border p-2"><option value="false">Active</option><option value="true">Archived</option></select></label>
      <label>Source name <input name="sourceSearch" defaultValue={sourceSearch} maxLength={100} className="rounded border p-2" /></label>
      <button type="submit" className="rounded border px-3">Filter</button>
    </form>
    <MonsterInstancePanel campaignId={id} rows={rows} />
    <nav aria-label="Monster roster pages" className="flex gap-3">{page > 0 ? <Link href={paging(page - 1)}>Previous</Link> : null}{rows.length === 20 && page < 500 ? <Link href={paging(page + 1)}>Next</Link> : null}</nav>
    <section className="min-w-0 space-y-3"><h2 className="j-display text-xl">Add a monster instance</h2>
      <p className="text-sm">Up to 100 matching sources are listed. Filter source names to find another template.</p>
      {sourceResult.status === "rejected" ? <p role="alert">New monster sources are unavailable. Existing instance and operation recovery remain available; new acquisition is blocked.</p> : null}
      <MonsterInstanceForm key={`${ctx.ownerId}:${id}:create`} campaignId={id} ownerId={ctx.ownerId} sources={sources} />
    </section>
  </div>;
}
