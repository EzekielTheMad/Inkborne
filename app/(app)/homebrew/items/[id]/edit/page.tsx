import { notFound, redirect } from "next/navigation";

import { ItemForm } from "@/components/library/item-form";
import { getOwnedHomebrewItem } from "@/lib/supabase/homebrew-items-server";
import { createClient } from "@/lib/supabase/server";

interface EditHomebrewItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewItemPage({
  params,
}: EditHomebrewItemPageProps) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { id } = await params;
  const item = await getOwnedHomebrewItem(id);
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
          Homebrew edits create a new immutable version. Existing character inventory pins keep their saved version.
        </p>
      </div>
      <ItemForm
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
