import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnedHomebrewNpc } from "@/lib/supabase/homebrew-npcs-server";
import { NpcForm } from "@/components/library/npc-form";
export default async function EditNpcPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createClient(); const { data: { user }, error } = await client.auth.getUser(); if (error || !user) redirect("/login");
  const { id } = await params; let record;
  try { record = await getOwnedHomebrewNpc(id); } catch { return <div role="alert" className="j-card-paper mx-auto max-w-3xl space-y-3 p-6">
    <h1 className="j-display text-2xl">NPC unavailable for editing</h1><p>This NPC could not be loaded or contains unsupported data. No changes were saved.</p><Link href="/homebrew">Return to Homebrew</Link></div>; }
  if (!record) notFound();
  return <div className="mx-auto w-full max-w-3xl space-y-6"><h1 className="j-display text-3xl [overflow-wrap:anywhere]">Edit {record.name}</h1>
    <p>Private NPC · read version {record.version}</p><NpcForm key={`${record.id}:${record.version}`} mode="edit" initialValue={record} /></div>;
}
