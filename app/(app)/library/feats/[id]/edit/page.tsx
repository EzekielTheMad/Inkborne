import { notFound, redirect } from "next/navigation";

import { FeatForm } from "@/components/library/feat-form";
import { getOwnedHomebrewFeat } from "@/lib/supabase/homebrew-feats-server";
import { createClient } from "@/lib/supabase/server";

interface EditHomebrewFeatPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewFeatPage({ params }: EditHomebrewFeatPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const feat = await getOwnedHomebrewFeat(id);
  if (!feat) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Private homebrew · version {feat.version}</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">Edit {feat.name}</h1>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Library edits create a new immutable version. Characters that later use this feat remain pinned.
        </p>
      </div>
      <FeatForm
        mode="edit"
        initialValue={{ id: feat.id, name: feat.name, version: feat.version, data: feat.data }}
      />
    </div>
  );
}
