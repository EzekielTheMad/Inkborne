import { notFound, redirect } from "next/navigation";

import { BackgroundForm } from "@/components/library/background-form";
import { BackgroundSharingPanel } from "@/components/library/background-sharing-panel";
import {
  getHomebrewBackgroundCampaignAccess,
  getOwnedHomebrewBackground,
} from "@/lib/supabase/homebrew-backgrounds-server";
import { createClient } from "@/lib/supabase/server";

interface EditHomebrewBackgroundPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHomebrewBackgroundPage({
  params,
}: EditHomebrewBackgroundPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const background = await getOwnedHomebrewBackground(id);
  if (!background) notFound();
  const campaignAccess = await getHomebrewBackgroundCampaignAccess(background.id);
  if (!campaignAccess) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">
            {background.scope === "shared" ? "Shared homebrew" : "Private homebrew"}
            {" · version "}{background.version}
          </p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
            Edit {background.name}
          </h1>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Library edits create a new immutable version. Existing character pins stay unchanged.
        </p>
      </div>
      <BackgroundForm
        mode="edit"
        initialValue={{
          id: background.id,
          name: background.name,
          version: background.version,
          data: background.data,
        }}
      />
      <BackgroundSharingPanel
        contentId={background.id}
        version={background.version}
        scope={background.scope}
        sharedCampaignCount={campaignAccess.sharedCampaignCount}
        campaigns={campaignAccess.campaigns}
      />
    </div>
  );
}
