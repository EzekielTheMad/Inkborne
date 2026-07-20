import { redirect } from "next/navigation";

import { SpellForm } from "@/components/library/spell-form";
import { createClient } from "@/lib/supabase/server";
import { listHomebrewSpellClassOptions } from "@/lib/supabase/homebrew-spells-server";

export default async function NewHomebrewSpellPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const classes = await listHomebrewSpellClassOptions();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="j-folio">Private homebrew</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">Create a spell</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Start with the narrative essentials. Automation is optional and feeds the existing casting tools when provided.
        </p>
      </div>
      <SpellForm mode="create" classes={classes} />
    </div>
  );
}
