"use client";

import Link from "next/link";
import { NarrativeTab } from "@/components/narrative/narrative-tab";
import { useCharacter, usePortrait } from "@/lib/character/character-context";
import type { CampaignPageBacklink } from "@/lib/campaigns/backlinks";

interface NarrativePanelProps {
  campaignPageBacklinks: CampaignPageBacklink[];
}

export function NarrativePanel({ campaignPageBacklinks }: NarrativePanelProps) {
  const { character, isOwner, isDm } = useCharacter();
  const { setPortrait } = usePortrait();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <NarrativeTab
        character={character}
        campaignId={character.campaign_id}
        isOwner={isOwner}
        isDm={isDm}
        onPortraitChange={(url) => setPortrait({ url: url ?? undefined })}
        onCropChange={(crop) => setPortrait({ crop })}
      />
      {character.campaign_id && campaignPageBacklinks.length > 0 && (
        <aside className="j-card-paper mt-6 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Linked from campaign
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {campaignPageBacklinks.map((backlink) => (
              <Link
                key={backlink.id}
                href={`/campaigns/${character.campaign_id}/pages/${backlink.id}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent/50 hover:text-accent"
              >
                {backlink.title}
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
