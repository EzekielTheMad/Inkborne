import { notFound, redirect } from "next/navigation";

import { ArmorForm } from "@/components/library/armor-form";
import { getOwnedHomebrewArmor } from "@/lib/supabase/homebrew-armors-server";
import { createClient } from "@/lib/supabase/server";

interface EditHomebrewArmorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewArmorPage({
  params,
}: EditHomebrewArmorPageProps) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { id } = await params;
  const armor = await getOwnedHomebrewArmor(id);
  if (!armor) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Private homebrew · version {armor.version}</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
            Edit {armor.name}
          </h1>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Homebrew edits create a new immutable version. Existing character inventory pins keep their saved version.
        </p>
      </div>
      <ArmorForm
        mode="edit"
        initialValue={{
          id: armor.id,
          name: armor.name,
          version: armor.version,
          data: armor.data,
        }}
      />
    </div>
  );
}
