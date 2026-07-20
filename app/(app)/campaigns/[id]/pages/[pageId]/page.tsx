import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { LockKeyholeIcon } from "lucide-react";
import { CampaignPageEditor } from "@/components/campaigns/campaign-page-editor";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { normalizeRichTextContent } from "@/lib/editor/content";
import {
  findCampaignPageBacklinks,
  findCharacterNarrativeBacklinks,
} from "@/lib/campaigns/backlinks";

interface CampaignWikiPageProps {
  params: Promise<{ id: string; pageId: string }>;
}

export default async function CampaignWikiPage({ params }: CampaignWikiPageProps) {
  const { id, pageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: campaign },
    { data: page },
    { data: linkCandidates },
    { data: characterCandidates },
  ] = await Promise.all([
    supabase.from("campaigns").select("id, name, owner_id").eq("id", id).single(),
    supabase
      .from("campaign_pages")
      .select("id, campaign_id, title, content, visibility, revision, created_by, updated_at")
      .eq("id", pageId)
      .eq("campaign_id", id)
      .single(),
    supabase
      .from("campaign_pages")
      .select("id, title, content")
      .eq("campaign_id", id)
      .order("title"),
    supabase
      .from("characters")
      .select("id, name, narrative_rich")
      .eq("campaign_id", id)
      .eq("archived", false)
      .order("name"),
  ]);
  if (!campaign || !page) notFound();

  const characterIds = (characterCandidates ?? []).map((candidate) => candidate.id);
  const { data: visibleDmNotes } = characterIds.length
    ? await supabase
        .from("character_dm_notes")
        .select("character_id, content")
        .in("character_id", characterIds)
    : { data: [] };
  const dmNotesByCharacter = new Map(
    (visibleDmNotes ?? []).map((note) => [note.character_id, note.content]),
  );

  const canEdit = campaign.owner_id === user.id || page.created_by === user.id;
  const content = normalizeRichTextContent(page.content) as JSONContent;
  const visibility = page.visibility === "dm_only" ? "dm_only" : "campaign";
  const backlinks = findCampaignPageBacklinks(linkCandidates ?? [], page.id);
  const characterBacklinks = findCharacterNarrativeBacklinks(
    (characterCandidates ?? []).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      narrativeRich: candidate.narrative_rich,
      dmNotes: dmNotesByCharacter.get(candidate.id),
    })),
    page.id,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/campaigns/${campaign.id}`}
            className="text-xs text-muted-foreground transition-colors hover:text-accent"
          >
            ← {campaign.name}
          </Link>
          {!canEdit && <h1 className="j-display mt-2 text-3xl text-foreground">{page.title}</h1>}
        </div>
        <div className="flex items-center gap-2">
          {visibility === "dm_only" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <LockKeyholeIcon className="size-3" /> Author and DM
            </span>
          )}
          <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Page index
          </Link>
        </div>
      </div>

      {canEdit ? (
        <CampaignPageEditor
          campaignId={campaign.id}
          pageId={page.id}
          title={page.title}
          content={content}
          visibility={visibility}
          revision={page.revision}
        />
      ) : (
        <article className="j-card-paper min-h-96 p-5 sm:p-7">
          <RichTextRenderer content={content} />
          {(!content || !content.content?.length) && (
            <p className="text-sm italic text-muted-foreground">This page is still blank.</p>
          )}
        </article>
      )}

      {(backlinks.length > 0 || characterBacklinks.length > 0) && (
        <aside className="j-card-paper p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Linked from
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {backlinks.map((backlink) => (
              <Link
                key={backlink.id}
                href={`/campaigns/${campaign.id}/pages/${backlink.id}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent/50 hover:text-accent"
              >
                {backlink.title}
              </Link>
            ))}
            {characterBacklinks.map((backlink) => (
              <Link
                key={`character-${backlink.id}`}
                href={`/characters/${backlink.id}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent/50 hover:text-accent"
              >
                {backlink.name}
                {backlink.source === "dm_notes" && " · DM notes"}
                {backlink.source === "narrative_and_dm_notes" && " · Story + DM notes"}
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
