import { redirect } from "next/navigation";

import { WeaponForm } from "@/components/library/weapon-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewHomebrewWeaponPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="j-folio">Homebrew workshop</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
          Create a weapon
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Create a private weapon with damage, range, and equipment properties.
        </p>
      </div>
      <WeaponForm mode="create" />
    </div>
  );
}
