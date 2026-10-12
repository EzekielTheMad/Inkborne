import { notFound, redirect } from "next/navigation";

import { RaceForm } from "@/components/library/race-form";
import { getOwnedHomebrewRace } from "@/lib/supabase/homebrew-races-server";
import { createClient } from "@/lib/supabase/server";

interface EditHomebrewRacePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewRacePage({
  params,
}: EditHomebrewRacePageProps) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { id } = await params;
  const race = await getOwnedHomebrewRace(id);
  if (!race) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Private homebrew · version {race.version}</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
            Edit {race.name}
          </h1>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Homebrew edits create a new immutable version. Existing character pins keep their saved version.
        </p>
      </div>
      <RaceForm
        mode="edit"
        initialValue={{
          id: race.id,
          name: race.name,
          version: race.version,
          data: race.data,
          walkingEditable: race.walkingEditable,
        }}
      />
    </div>
  );
}
