import { redirect } from "next/navigation";

import { BackgroundForm } from "@/components/library/background-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewHomebrewBackgroundPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="j-folio">Homebrew workshop</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
          Create a background
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Define the character&apos;s prior life, proficiencies, starting resources, feature, and
          story prompts using the same structured rules as built-in backgrounds.
        </p>
      </div>
      <BackgroundForm mode="create" />
    </div>
  );
}
