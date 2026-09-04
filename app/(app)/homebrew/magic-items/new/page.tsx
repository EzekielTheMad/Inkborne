import { redirect } from "next/navigation";

import { MagicItemForm } from "@/components/library/magic-item-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewHomebrewMagicItemPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="j-folio">Homebrew workshop</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
          Create a magic item
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Describe a private magic item for your Library. Mechanical effects are not authored here.
        </p>
      </div>
      <MagicItemForm mode="create" />
    </div>
  );
}
