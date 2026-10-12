import { redirect } from "next/navigation";
import { MonsterForm } from "@/components/library/monster-form";
import { createClient } from "@/lib/supabase/server";
export default async function NewHomebrewMonsterPage() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  return <div className="mx-auto w-full max-w-3xl space-y-6"><div><p className="j-folio">Homebrew workshop</p>
    <h1 className="j-display mt-2 text-3xl">Create a monster</h1><p className="mt-2 text-sm text-muted-foreground">Build a private stat block with structured, declared values.</p></div>
    <MonsterForm mode="create" /></div>;
}
