import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { LockKeyholeIcon } from "lucide-react";
import { CampaignPageEditor } from "@/components/campaigns/campaign-page-editor";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { normalizeRichTextContent } from "@/lib/editor/content";

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

  const [{ data: campaign }, { data: page }] = await Promise.all([
    supabase.from("campaigns").select("id, name, owner_id").eq("id", id).single(),
    supabase
      .from("campaign_pages")
      .select("id, campaign_id, title, content, visibility, revision, created_by, updated_at")
      .eq("id", pageId)
      .eq("campaign_id", id)
      .single(),
  ]);
  if (!campaign || !page) notFound();

  const canEdit = campaign.owner_id === user.id || page.created_by === user.id;
  const content = normalizeRichTextContent(page.content) as JSONContent;
  const visibility = page.visibility === "dm_only" ? "dm_only" : "campaign";

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
    </div>
  );
}
