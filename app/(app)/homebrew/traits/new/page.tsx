import { redirect } from "next/navigation";
import { TraitForm } from "@/components/library/trait-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewHomebrewTraitPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6"><h1 className="j-display text-3xl">Create private trait</h1><TraitForm mode="create" /></div>;
}
