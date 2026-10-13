"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { RefreshCw, ShieldCheck, Users } from "lucide-react";

import {
  toggleHomebrewItemCampaignShare,
  type HomebrewItemShareActionState,
} from "@/app/(app)/homebrew/items/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HomebrewItemCampaignOption } from "@/lib/supabase/homebrew-items-server";

interface ItemSharingPanelProps {
  contentId: string;
  version: number;
  scope: "personal" | "shared";
  sharedCampaignCount: number;
  campaigns: HomebrewItemCampaignOption[];
}

type ShareRequest = { contentId: string; campaignId: string; enabled: boolean; expectedVersion: number };
type PanelState = HomebrewItemShareActionState & { baseline?: string; campaignStates?: Record<string, boolean>; commitToken?: number };
const initialState: PanelState = { status: "idle", message: "" };

function uncertain(request: ShareRequest): HomebrewItemShareActionState {
  return { status: "uncertain", message: "Campaign access could not be confirmed. Reload latest access before making another change.", ...request };
}

// Transported action results are untrusted until they acknowledge this exact request.
function admitActionResult(value: unknown, request: ShareRequest): HomebrewItemShareActionState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.status !== "string" || !["idle", "error", "conflict", "uncertain"].includes(row.status) || typeof row.message !== "string" || !row.message.trim() || row.message.length > 2000) return null;
  if (row.contentId !== request.contentId || row.campaignId !== request.campaignId || row.enabled !== request.enabled || row.expectedVersion !== request.expectedVersion) return null;
  const keys = ["status", "message", "contentId", "campaignId", "enabled", "expectedVersion"];
  if (row.status === "idle") {
    keys.push("version", "scope", "sharedCampaignCount");
    if (typeof row.version !== "number" || !Number.isInteger(row.version) || row.version < 1 || row.version > 2147483647 || (row.version !== request.expectedVersion && row.version !== request.expectedVersion + 1)) return null;
    if (row.scope !== "personal" && row.scope !== "shared") return null;
    if (typeof row.sharedCampaignCount !== "number" || !Number.isSafeInteger(row.sharedCampaignCount) || row.sharedCampaignCount < 0 || (row.scope === "shared") !== (row.sharedCampaignCount > 0) || (request.enabled && row.sharedCampaignCount === 0)) return null;
  }
  if (Object.keys(row).some(key => !keys.includes(key))) return null;
  return row as HomebrewItemShareActionState;
}

function versionEffect(
  shared: boolean,
  scope: "personal" | "shared",
  sharedCampaignCount: number,
  version: number,
) {
  if (version === 2147483647 && ((!shared && scope === "personal") || (shared && sharedCampaignCount === 1))) return "This item has reached its version limit; scope changes are unavailable.";
  if (!shared && scope === "personal") {
    return `Sharing creates version ${version + 1} because this item becomes Shared.`;
  }
  if (shared && sharedCampaignCount === 1) {
    return `Removing final access creates version ${version + 1} because this item becomes Private.`;
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

export function ItemSharingPanel({
  contentId,
  version,
  scope,
  sharedCampaignCount,
  campaigns,
}: ItemSharingPanelProps) {
  // Fold confirmed toggles only while the authoritative props remain the same.
  // Fresh server access props supersede the local overlay; uncertainty still
  // requires explicit reload. No overlay is a permission or write authority.
  const baseline = JSON.stringify([contentId, version, scope, sharedCampaignCount, campaigns]);
  const submission = useRef({ busy: false, blocked: false, token: 0 });
  const [state, action, pending] = useActionState(async (previous: PanelState, data: FormData): Promise<PanelState> => {
    const token = submission.current.token;
    const priorApplies = previous.baseline === baseline && previous.contentId === contentId;
    const campaignStates: Record<string, boolean> = priorApplies ? { ...previous.campaignStates } : {};
    const campaignId = String(data.get("campaign_id") ?? "");
    const campaign = campaigns.find(option => option.id === campaignId);
    const request = { contentId, campaignId, enabled: data.get("enabled") === "true", expectedVersion: Number(data.get("expected_version")) };
    const submittedVersion = priorApplies ? previous.version ?? version : version;
    const rawEnabled = data.get("enabled");
    let result = uncertain(request);
    if (data.get("content_id") === contentId && campaign && (rawEnabled === "true" || rawEnabled === "false") && request.enabled !== (campaignStates[campaignId] ?? campaign.shared) && request.expectedVersion === submittedVersion && Number.isInteger(submittedVersion) && submittedVersion >= 1 && submittedVersion <= 2147483647) {
      try {
        result = admitActionResult(await toggleHomebrewItemCampaignShare(previous, data), request) ?? uncertain(request);
      } catch (error) {
        try { unstable_rethrow(error); }
        finally { submission.current.blocked = true; }
      }
    }
    // Block immediately, before React schedules the returned state. Do not reopen
    // the native submit gate in a promise finally/settlement callback.
    if (result.status === "uncertain" || result.status === "conflict") submission.current.blocked = true;
    if (result.status === "idle") campaignStates[campaignId] = request.enabled;
    return { ...result,
      version: result.version ?? submittedVersion,
      scope: result.scope ?? (priorApplies ? previous.scope ?? scope : scope),
      sharedCampaignCount: result.sharedCampaignCount ?? (priorApplies ? previous.sharedCampaignCount ?? sharedCampaignCount : sharedCampaignCount),
      baseline, campaignStates, commitToken: token };
  }, initialState);
  useEffect(() => {
    if (!pending && state.commitToken === submission.current.token && !submission.current.blocked) submission.current.busy = false;
  }, [pending, state.commitToken]);
  const applies = state.contentId === contentId && state.baseline === baseline;
  const currentVersion = applies ? state.version ?? version : version;
  const currentScope = applies ? state.scope ?? scope : scope;
  const currentSharedCampaignCount = applies ? state.sharedCampaignCount ?? sharedCampaignCount : sharedCampaignCount;
  const unresolved = state.status === "conflict" || state.status === "uncertain";
  return (
    <section
      className="j-card-paper space-y-5 p-5 sm:p-7"
      aria-labelledby="item-campaign-access-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-accent" aria-hidden="true" />
            <h2 id="item-campaign-access-heading" className="j-folio">Campaign access</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Share this item with campaigns you belong to. Campaign members can discover the
            current version in the Library, but only you can edit it.
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
          Join or create a D&amp;D 5e (2014) campaign to share this item.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 rounded-lg border border-border/70">
          {campaigns.map((campaign) => {
            const shared = applies ? state.campaignStates?.[campaign.id] ?? campaign.shared : campaign.shared;
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
                <form action={action} onSubmit={event => {
                  if (pending || unresolved || submission.current.busy || submission.current.blocked) event.preventDefault();
                  else { submission.current.busy = true; submission.current.token += 1; }
                }} className="shrink-0">
                  <input type="hidden" name="content_id" value={contentId} />
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <input type="hidden" name="enabled" value={String(!shared)} />
                  <input type="hidden" name="expected_version" value={currentVersion} />
                  <CampaignShareButton
                    shared={shared}
                    label={label}
                    disabled={pending || unresolved || (!campaign.eligible && !shared) || (currentVersion === 2147483647 && ((!shared && currentScope === "personal") || (shared && currentSharedCampaignCount === 1)))}
                  />
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {state.message && (
        <p
          role={state.status === "error" || unresolved ? "alert" : "status"}
          className={state.status === "error" || unresolved
            ? "text-sm text-destructive"
            : "text-sm text-accent"}
        >
          {state.message}
        </p>
      )}
      {unresolved && (
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Reload latest access
        </Button>
      )}
    </section>
  );
}
