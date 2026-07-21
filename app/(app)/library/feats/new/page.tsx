import { redirect } from "next/navigation";

import { FeatForm } from "@/components/library/feat-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewHomebrewFeatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="j-folio">Private homebrew</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">Create a feat</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Write the story first, then add the small set of safe automations that apply directly to a character sheet.
        </p>
      </div>
      <FeatForm mode="create" />
    </div>
  );
}
