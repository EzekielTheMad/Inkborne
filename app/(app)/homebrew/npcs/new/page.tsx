import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NpcForm } from "@/components/library/npc-form";
export default async function NewNpcPage() {
  const client = await createClient(); const { data: { user }, error } = await client.auth.getUser(); if (error || !user) redirect("/login");
  return <div className="mx-auto w-full max-w-3xl space-y-6"><h1 className="j-display text-3xl">Create private NPC</h1><NpcForm mode="create" /></div>;
}
