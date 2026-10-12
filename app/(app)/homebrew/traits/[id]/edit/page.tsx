import { notFound, redirect } from "next/navigation";
import { TraitForm } from "@/components/library/trait-form";
import { getOwnedHomebrewTrait } from "@/lib/supabase/homebrew-traits-server";
import { createClient } from "@/lib/supabase/server";

export default async function EditHomebrewTraitPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { id } = await params;
  const trait = await getOwnedHomebrewTrait(id);
  if (!trait) notFound();
  return <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6"><h1 className="j-display text-3xl">Edit private trait</h1>
    <p className="text-sm text-muted-foreground">Save a new catalog version. Existing character snapshots remain unchanged.</p>
    <TraitForm mode="edit" initialValue={{ id: trait.id, name: trait.name, version: trait.version, data: trait.data, resourceEditable: trait.resourceEditable }} /></div>;
}
