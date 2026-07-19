import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BookOpenIcon,
  CrownIcon,
  LockKeyholeIcon,
  ScrollTextIcon,
  UserRoundIcon,
} from "lucide-react";
import {
  assignCharacterToCampaign,
  leaveCampaign,
  unassignCharacterFromCampaign,
} from "@/app/(app)/campaigns/actions";
import { ConfirmActionButton } from "@/components/campaigns/confirm-action-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

interface CampaignPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function CampaignPage({ params, searchParams }: CampaignPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, description, owner_id, invite_code, system_id, game_systems(name)")
    .eq("id", id)
    .single();
  if (!campaign) notFound();

  const isOwner = campaign.owner_id === user.id;
  const [membersResult, charactersResult, pagesResult, availableCharactersResult] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("user_id, role, profiles(display_name, avatar_url)")
      .eq("campaign_id", id)
      .order("joined_at"),
    supabase
      .from("characters")
      .select("id, name, level, user_id, visibility")
      .eq("campaign_id", id)
      .eq("archived", false)
      .order("name"),
    supabase
      .from("campaign_pages")
      .select("id, title, parent_id, visibility, created_by, updated_at")
      .eq("campaign_id", id)
      .order("title"),
    supabase
      .from("characters")
      .select("id, name, level")
      .eq("user_id", user.id)
      .eq("system_id", campaign.system_id)
      .is("campaign_id", null)
      .eq("archived", false)
      .order("name"),
  ]);

  for (const [source, result] of [
    ["members", membersResult],
    ["characters", charactersResult],
    ["pages", pagesResult],
    ["available characters", availableCharactersResult],
  ] as const) {
    if (result.error) {
      console.error(`[CampaignPage] Failed to load ${source}:`, result.error);
    }
  }

  const system = Array.isArray(campaign.game_systems)
    ? campaign.game_systems[0]
    : campaign.game_systems;
  const pages = pagesResult.data ?? [];
  const availablePageIds = new Set(pages.map((page) => page.id));

  function pageDepth(pageId: string, seen = new Set<string>()): number {
    if (seen.has(pageId)) return 0;
    seen.add(pageId);
    const page = pages.find((candidate) => candidate.id === pageId);
    if (!page?.parent_id || !availablePageIds.has(page.parent_id)) return 0;
    return Math.min(4, 1 + pageDepth(page.parent_id, seen));
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="j-folio">{system?.name ?? "Campaign"}</p>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {isOwner ? "DM workspace" : "Player view"}
            </span>
          </div>
          <h1 className="j-display mt-1.5 text-3xl text-foreground">{campaign.name}</h1>
          {campaign.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {campaign.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Link
              href={`/campaigns/${campaign.id}/settings`}
              className={buttonVariants({ variant: "outline" })}
            >
              Settings
            </Link>
          )}
          <Link
            href={`/campaigns/${campaign.id}/pages/new`}
            className={buttonVariants({ variant: "gold" })}
          >
            + New page
          </Link>
        </div>
      </header>

      {query.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          The campaign change could not be completed. Please try again.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                <BookOpenIcon className="size-4" /> World pages
              </h2>
              <span className="text-xs text-muted-foreground">{pages.length} visible</span>
            </div>
            {pages.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border bg-paper-2">
                {pages.map((page) => {
                  const depth = pageDepth(page.id);
                  return (
                    <Link
                      key={page.id}
                      href={`/campaigns/${campaign.id}/pages/${page.id}`}
                      className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-accent/5"
                      style={{ paddingLeft: `${16 + depth * 22}px` }}
                    >
                      <ScrollTextIcon className="size-4 shrink-0 text-accent/75" />
                      <span className="min-w-0 flex-1 truncate text-foreground">{page.title}</span>
                      {page.visibility === "dm_only" && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          <LockKeyholeIcon className="size-3" /> Hidden
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <ScrollTextIcon className="mx-auto size-7 text-accent/60" />
                <p className="j-display mt-3 text-lg text-foreground">The chronicle is blank.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a first page for places, sessions, people, or lore.
                </p>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                <UserRoundIcon className="size-4" /> Characters
              </h2>
              <span className="text-xs text-muted-foreground">
                {(charactersResult.data ?? []).length} visible
              </span>
            </div>
            {(charactersResult.data ?? []).length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(charactersResult.data ?? []).map((character) => (
                  <div
                    key={character.id}
                    className="j-card-paper flex items-center justify-between gap-3 p-4"
                  >
                    <Link href={`/characters/${character.id}`} className="min-w-0 flex-1 group">
                      <p className="j-display truncate text-base text-foreground transition-colors group-hover:text-accent">
                        {character.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Level {character.level}</p>
                    </Link>
                    <div className="flex items-center gap-2">
                      {character.visibility === "private" && (
                        <LockKeyholeIcon className="size-3.5 text-muted-foreground" />
                      )}
                      {character.user_id === user.id && (
                        <form action={unassignCharacterFromCampaign}>
                          <input type="hidden" name="campaign_id" value={campaign.id} />
                          <input type="hidden" name="character_id" value={character.id} />
                          <Button type="submit" variant="ghost" size="sm">Remove</Button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                No campaign characters are visible yet.
              </p>
            )}

            {(availableCharactersResult.data ?? []).length > 0 && (
              <form
                action={assignCharacterToCampaign}
                className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-paper-2 p-3 sm:flex-row"
              >
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <select
                  name="character_id"
                  aria-label="Character to add"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  required
                >
                  <option value="">Add one of your characters</option>
                  {(availableCharactersResult.data ?? []).map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} · Level {character.level}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">Add character</Button>
              </form>
            )}
          </section>
        </main>

        <aside className="space-y-5">
          <section className="j-card-paper p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              <CrownIcon className="size-4" /> Table
            </h2>
            <div className="mt-3 space-y-2">
              {(membersResult.data ?? []).map((member) => {
                const profile = Array.isArray(member.profiles)
                  ? member.profiles[0]
                  : member.profiles;
                return (
                  <div key={member.user_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-foreground">
                      {profile?.display_name || "Unnamed adventurer"}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      {member.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {isOwner && (
            <section className="rounded-xl border border-accent/25 bg-accent/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                Invite players
              </p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">
                {campaign.invite_code}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Anyone with this code can join as a player. Rotate it from campaign settings.
              </p>
            </section>
          )}

          {!isOwner && (
            <form action={leaveCampaign}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <ConfirmActionButton
                type="submit"
                variant="outline"
                className="w-full text-destructive"
                confirmation="Leave this campaign? Your characters will be detached from it."
              >
                Leave campaign
              </ConfirmActionButton>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
