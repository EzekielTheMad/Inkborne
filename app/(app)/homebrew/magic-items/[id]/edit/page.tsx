import { notFound, redirect } from "next/navigation";

import { MagicItemForm } from "@/components/library/magic-item-form";
import { getOwnedHomebrewMagicItem } from "@/lib/supabase/homebrew-magic-items-server";
import { createClient } from "@/lib/supabase/server";

interface EditHomebrewMagicItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewMagicItemPage({
  params,
}: EditHomebrewMagicItemPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const item = await getOwnedHomebrewMagicItem(id);
  if (!item) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Private homebrew · version {item.version}</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
            Edit {item.name}
          </h1>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Homebrew edits create a new immutable version. Library readers receive the latest version.
        </p>
      </div>
      <MagicItemForm
        mode="edit"
        initialValue={{
          id: item.id,
          name: item.name,
          version: item.version,
          data: item.data,
        }}
      />
    </div>
  );
}
