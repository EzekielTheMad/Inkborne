import { notFound, redirect } from "next/navigation";

import { WeaponForm } from "@/components/library/weapon-form";
import { getOwnedHomebrewWeapon } from "@/lib/supabase/homebrew-weapons-server";
import { createClient } from "@/lib/supabase/server";

interface EditHomebrewWeaponPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewWeaponPage({
  params,
}: EditHomebrewWeaponPageProps) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { id } = await params;
  const weapon = await getOwnedHomebrewWeapon(id);
  if (!weapon) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Private homebrew · version {weapon.version}</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
            Edit {weapon.name}
          </h1>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Homebrew edits create a new immutable version. Existing character inventory pins keep their saved version.
        </p>
      </div>
      <WeaponForm
        mode="edit"
        initialValue={{
          id: weapon.id,
          name: weapon.name,
          version: weapon.version,
          data: weapon.data,
        }}
      />
    </div>
  );
}
