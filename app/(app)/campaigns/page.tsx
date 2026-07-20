import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenIcon, CrownIcon, UsersIcon } from "lucide-react";
import { joinCampaign } from "@/app/(app)/campaigns/actions";
import { buttonVariants, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

interface CampaignsPageProps {
  searchParams: Promise<{ error?: string }>;
}

const inviteErrors: Record<string, string> = {
  invalid_invite: "Enter the invite code exactly as the DM shared it.",
  invite_not_found: "That invite code is invalid or no longer active.",
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, description, owner_id, game_systems(name)")
    .order("updated_at", { ascending: false });

  if (error) console.error("[CampaignsPage] Failed to load campaigns:", error);

  const inviteError = query.error ? inviteErrors[query.error] : null;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Shared worlds</p>
          <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Characters, lore, and secrets gathered into one living chronicle.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className={buttonVariants({ variant: "gold" }) + " w-full sm:w-auto"}
        >
          + Begin a campaign
        </Link>
      </div>

      <form
        action={joinCampaign}
        className="flex flex-col gap-2 rounded-lg border border-border bg-paper-2 p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="invite-code"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Join with an invite code
          </label>
          <Input
            id="invite-code"
            name="invite_code"
            placeholder="Paste campaign code"
            autoComplete="off"
            required
          />
        </div>
        <Button type="submit" variant="outline">
          Join campaign
        </Button>
      </form>
      {inviteError && (
        <p role="alert" className="-mt-5 text-sm text-destructive">
          {inviteError}
        </p>
      )}

      {campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => {
            const isOwner = campaign.owner_id === user.id;
            const system = Array.isArray(campaign.game_systems)
              ? campaign.game_systems[0]
              : campaign.game_systems;
            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="j-card-paper group block p-5 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="j-display text-xl text-foreground">{campaign.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {system?.name ?? "Unknown system"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {isOwner ? <CrownIcon className="size-3 text-accent" /> : <UsersIcon className="size-3" />}
                    {isOwner ? "DM" : "Player"}
                  </span>
                </div>
                <p className="mt-4 line-clamp-3 min-h-12 text-sm leading-relaxed text-muted-foreground">
                  {campaign.description || "An unwritten campaign chronicle."}
                </p>
                <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-accent">
                  <BookOpenIcon className="size-3.5" /> Open chronicle
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <BookOpenIcon className="mx-auto size-8 text-accent/70" />
          <h2 className="j-display mt-3 text-xl text-foreground">No campaigns yet.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Begin a world as its DM, or join one with an invite code.
          </p>
        </div>
      )}
    </div>
  );
}
