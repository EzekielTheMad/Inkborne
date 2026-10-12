import { redirect } from "next/navigation";
import { PassiveFeatureForm } from "@/components/library/passive-feature-form";
import { createClient } from "@/lib/supabase/server";
export default async function NewPassiveFeaturePage() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  return <div className="mx-auto w-full max-w-3xl space-y-6"><div><p className="j-folio">Homebrew workshop</p>
    <h1 className="j-display mt-2 text-3xl">Create a passive feature</h1><p className="mt-2 text-sm text-muted-foreground">Write a private standalone feature with a descriptive, unverified association.</p></div>
    <PassiveFeatureForm mode="create" /></div>;
}
