import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MonsterForm } from "@/components/library/monster-form";
import { getOwnedHomebrewMonster } from "@/lib/supabase/homebrew-monsters-server";
import { createClient } from "@/lib/supabase/server";
export default async function EditHomebrewMonsterPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  const { id } = await params;
  let monster;
  try { monster = await getOwnedHomebrewMonster(id); } catch {
    return <div className="j-card-paper mx-auto max-w-3xl space-y-3 p-6" role="alert"><h1 className="j-display text-2xl">Monster unavailable for editing</h1>
      <p>This monster could not be loaded or contains unsupported data. No changes were saved.</p><Link href="/homebrew">Return to Homebrew</Link></div>;
  }
  if (!monster) notFound();
  return <div className="mx-auto w-full max-w-3xl space-y-6"><div><p className="j-folio">Private homebrew · version {monster.version}</p>
    <h1 className="j-display mt-2 text-3xl [overflow-wrap:anywhere]">Edit {monster.name}</h1></div><MonsterForm key={`${monster.id}:${monster.version}`} mode="edit" initialValue={monster} /></div>;
}
