import Link from "next/link";
import type { InstanceSummary } from "@/lib/campaigns/monster-instance-schema";
export function MonsterInstancePanel({ campaignId, rows }: { campaignId: string; rows: InstanceSummary[] }) {
  return <section className="min-w-0 space-y-3" aria-label="DM monster roster">
    <h2 className="j-display text-xl">Monsters · DM only</h2>
    {rows.length ? <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((row) => <li key={row.id} className="j-card-paper min-w-0 p-4 [overflow-wrap:anywhere]">
        <Link href={`/campaigns/${campaignId}/monsters/${row.id}`} className="j-display text-lg underline">{row.name}</Link>
        <p className="text-sm">Manual HP {row.current_hp} / {row.declared_max_hp}{row.archived ? " · Archived" : ""}</p>
      </li>)}
    </ul> : <p>No matching monster instances.</p>}
  </section>;
}
