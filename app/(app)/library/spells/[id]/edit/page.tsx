import { notFound, redirect } from "next/navigation";

import { SpellForm } from "@/components/library/spell-form";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnedHomebrewSpell,
  listHomebrewSpellClassOptions,
} from "@/lib/supabase/homebrew-spells-server";

interface EditHomebrewSpellPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewSpellPage({ params }: EditHomebrewSpellPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [spell, classes] = await Promise.all([
    getOwnedHomebrewSpell(id),
    listHomebrewSpellClassOptions(),
  ]);
  if (!spell) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Private homebrew · version {spell.version}</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">Edit {spell.name}</h1>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Library edits create a new immutable version. Existing character sheets remain pinned.
        </p>
      </div>
      <SpellForm
        mode="edit"
        classes={classes}
        initialValue={{ id: spell.id, name: spell.name, version: spell.version, data: spell.data }}
      />
    </div>
  );
}
