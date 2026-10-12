import { redirect } from "next/navigation";

import { ArmorForm } from "@/components/library/armor-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewHomebrewArmorPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="j-folio">Homebrew workshop</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
          Create armor
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Create private armor with its armor class, equipment cost, and weight.
        </p>
      </div>
      <ArmorForm mode="create" />
    </div>
  );
}
