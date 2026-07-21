import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  removeCampaignMember,
  revokeCampaignSharedContent,
  rotateCampaignInvite,
  updateCampaign,
} from "@/app/(app)/campaigns/actions";
import { ConfirmActionButton } from "@/components/campaigns/confirm-action-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { listCampaignSharedContentForOwner } from "@/lib/supabase/campaign-shared-content-server";
import { createClient } from "@/lib/supabase/server";

interface CampaignSettingsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    rotated?: string;
    content_error?: string;
    content_revoked?: string;
  }>;
}

export default async function CampaignSettingsPage({
  params,
  searchParams,
}: CampaignSettingsPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: campaign }, { data: members }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, description, owner_id, invite_code")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("campaign_members")
      .select("user_id, role, profiles(display_name)")
      .eq("campaign_id", id)
      .order("joined_at"),
  ]);
  if (!campaign) notFound();
  const sharedContent = await listCampaignSharedContentForOwner(id);

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <div>
        <Link
          href={`/campaigns/${campaign.id}`}
          className="text-xs text-muted-foreground transition-colors hover:text-accent"
        >
          ← {campaign.name}
        </Link>
        <p className="j-folio mt-4">DM controls</p>
        <h1 className="j-display mt-1.5 text-3xl text-foreground">Campaign settings</h1>
      </div>

      {(query.saved || query.rotated) && (
        <p role="status" className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-sm text-accent">
          {query.rotated ? "Invite code rotated." : "Campaign details saved."}
        </p>
      )}
      {query.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          The campaign change could not be completed. Try again.
        </p>
      )}
      {query.content_revoked && (
        <p role="status" className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-sm text-accent">
          Campaign content access removed. Existing character pins were preserved.
        </p>
      )}
      {query.content_error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          That content share could not be removed. Reload and try again.
        </p>
      )}

      <section className="j-card-paper p-5 sm:p-6">
        <h2 className="j-display text-xl text-foreground">Campaign details</h2>
        <form action={updateCampaign} className="mt-4 space-y-4">
          <input type="hidden" name="campaign_id" value={campaign.id} />
          <div className="space-y-2">
            <Label htmlFor="settings-name">Name</Label>
            <Input id="settings-name" name="name" defaultValue={campaign.name} maxLength={100} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-description">Description</Label>
            <textarea
              id="settings-description"
              name="description"
              defaultValue={campaign.description}
              maxLength={2000}
              rows={5}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="gold">Save details</Button>
          </div>
        </form>
      </section>

      <section className="j-card-paper p-5 sm:p-6">
        <h2 className="j-display text-xl text-foreground">Invite code</h2>
        <p className="mt-2 break-all font-mono text-sm text-foreground">{campaign.invite_code}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Rotating immediately invalidates the old code. Existing members are unaffected.
        </p>
        <form action={rotateCampaignInvite} className="mt-4">
          <input type="hidden" name="campaign_id" value={campaign.id} />
          <ConfirmActionButton
            type="submit"
            variant="outline"
            confirmation="Rotate the invite code? The current code will stop working."
          >
            Rotate invite code
          </ConfirmActionButton>
        </form>
      </section>

      <section className="j-card-paper p-5 sm:p-6">
        <h2 className="j-display text-xl text-foreground">Members</h2>
        <div className="mt-4 divide-y divide-border">
          {(members ?? []).map((member) => {
            const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
            const isDm = member.role === "dm" || member.user_id === campaign.owner_id;
            return (
              <div key={member.user_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {profile?.display_name || "Unnamed adventurer"}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {isDm ? "DM" : "Player"}
                  </p>
                </div>
                {!isDm && (
                  <form action={removeCampaignMember}>
                    <input type="hidden" name="campaign_id" value={campaign.id} />
                    <input type="hidden" name="member_user_id" value={member.user_id} />
                    <ConfirmActionButton
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      confirmation="Remove this player? Their characters will be detached from the campaign."
                    >
                      Remove
                    </ConfirmActionButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="j-card-paper p-5 sm:p-6">
        <h2 className="j-display text-xl text-foreground">Shared homebrew</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          You can withdraw campaign access without changing the author&apos;s content or editing any character.
        </p>
        {sharedContent.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No homebrew is currently shared with this campaign.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border rounded-lg border border-border">
            {sharedContent.map((content) => (
              <div key={content.contentId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{content.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="capitalize">{content.contentType}</Badge>
                    <Badge variant="secondary">v{content.version}</Badge>
                  </div>
                </div>
                <form action={revokeCampaignSharedContent}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <input type="hidden" name="content_id" value={content.contentId} />
                  <input type="hidden" name="content_type" value={content.contentType} />
                  <input type="hidden" name="expected_version" value={content.version} />
                  <ConfirmActionButton
                    type="submit"
                    variant="outline"
                    size="sm"
                    confirmation={`Remove ${content.name} from this campaign? Existing character pins will remain.`}
                  >
                    Remove access
                  </ConfirmActionButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "outline" })}>
          Back to campaign
        </Link>
      </div>
    </div>
  );
}
