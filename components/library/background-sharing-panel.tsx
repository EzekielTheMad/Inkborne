"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RefreshCw, ShieldCheck, Users } from "lucide-react";

import {
  toggleHomebrewBackgroundCampaignShare,
  type HomebrewBackgroundShareActionState,
} from "@/app/(app)/library/backgrounds/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HomebrewBackgroundCampaignOption } from "@/lib/supabase/homebrew-backgrounds-server";

interface BackgroundSharingPanelProps {
  contentId: string;
  version: number;
  scope: "personal" | "shared";
  sharedCampaignCount: number;
  campaigns: HomebrewBackgroundCampaignOption[];
}

const initialState: HomebrewBackgroundShareActionState = { status: "idle", message: "" };

function versionEffect(
  shared: boolean,
  scope: "personal" | "shared",
  sharedCampaignCount: number,
  version: number,
) {
  if (!shared && scope === "personal") {
    return `Sharing creates version ${version + 1} because this background becomes Shared.`;
  }
  if (shared && sharedCampaignCount === 1) {
    return `Removing final access creates version ${version + 1} because this background becomes Private.`;
  }
  return shared
    ? "Removing this campaign keeps the current version."
    : "Adding this campaign keeps the current version.";
}

function CampaignShareButton({
  shared,
  label,
  disabled,
}: {
  shared: boolean;
  label: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={shared ? "outline" : "gold"}
      disabled={disabled || pending}
      aria-label={label}
    >
      {pending ? "Updating..." : shared ? "Remove" : "Share"}
    </Button>
  );
}

export function BackgroundSharingPanel({
  contentId,
  version,
  scope,
  sharedCampaignCount,
  campaigns,
}: BackgroundSharingPanelProps) {
  const [state, action, pending] = useActionState(
    toggleHomebrewBackgroundCampaignShare,
    initialState,
  );
  const currentVersion = state.version ?? version;
  const currentScope = state.scope ?? scope;
  const currentSharedCampaignCount = state.sharedCampaignCount ?? sharedCampaignCount;

  return (
    <section
      className="j-card-paper space-y-5 p-5 sm:p-7"
      aria-labelledby="background-campaign-access-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-accent" aria-hidden="true" />
            <h2 id="background-campaign-access-heading" className="j-folio">Campaign access</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Share this background with campaigns you belong to. Campaign members can discover the
            current version in their character builder, but only you can edit it.
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Badge variant="outline">{currentScope === "shared" ? "Shared" : "Private"}</Badge>
          <Badge variant="secondary">v{currentVersion}</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            The first share and final unshare create an immutable version. Existing character pins
            remain unchanged.
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Join or create a D&amp;D 5e (2014) campaign to share this background.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 rounded-lg border border-border/70">
          {campaigns.map((campaign) => {
            const shared = state.status === "idle"
              && state.campaignId === campaign.id
              && typeof state.enabled === "boolean"
              ? state.enabled
              : campaign.shared;
            const label = shared
              ? `Stop sharing with ${campaign.name}`
              : `Share with ${campaign.name}`;
            return (
              <li
                key={campaign.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{campaign.name}</p>
                    {shared && <Badge variant="secondary">Shared</Badge>}
                    {!campaign.eligible && <Badge variant="outline">No longer a member</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {versionEffect(shared, currentScope, currentSharedCampaignCount, currentVersion)}
                  </p>
                </div>
                <form action={action} className="shrink-0">
                  <input type="hidden" name="content_id" value={contentId} />
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <input type="hidden" name="enabled" value={String(!shared)} />
                  <input type="hidden" name="expected_version" value={currentVersion} />
                  <CampaignShareButton
                    shared={shared}
                    label={label}
                    disabled={pending || state.status === "conflict" || (!campaign.eligible && !shared)}
                  />
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {state.message && (
        <p
          role={state.status === "error" || state.status === "conflict" ? "alert" : "status"}
          className={state.status === "error" || state.status === "conflict"
            ? "text-sm text-destructive"
            : "text-sm text-accent"}
        >
          {state.message}
        </p>
      )}
      {state.status === "conflict" && (
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Reload latest access
        </Button>
      )}
    </section>
  );
}
