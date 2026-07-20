import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createCampaignPage } from "@/app/(app)/campaigns/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

interface NewCampaignPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function NewCampaignPage({ params, searchParams }: NewCampaignPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: campaign }, { data: pages }] = await Promise.all([
    supabase.from("campaigns").select("id, name").eq("id", id).single(),
    supabase
      .from("campaign_pages")
      .select("id, title")
      .eq("campaign_id", id)
      .order("title"),
  ]);
  if (!campaign) notFound();

  const error = query.error
    ? query.error === "invalid_input"
      ? "Check the page title and visibility."
      : "The page could not be created. Try again."
    : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="j-folio">{campaign.name}</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">New page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The DM can always see campaign pages. You control whether other players can.
        </p>
      </div>

      <form action={createCampaignPage} className="j-card-paper space-y-5 p-5 sm:p-6">
        <input type="hidden" name="campaign_id" value={campaign.id} />
        <div className="space-y-2">
          <Label htmlFor="page-title">Page title</Label>
          <Input id="page-title" name="title" maxLength={200} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="page-parent">Place beneath</Label>
          <select
            id="page-parent"
            name="parent_id"
            defaultValue=""
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Top level</option>
            {(pages ?? []).map((page) => (
              <option key={page.id} value={page.id}>{page.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="page-visibility">Who can see it?</Label>
          <select
            id="page-visibility"
            name="visibility"
            defaultValue="campaign"
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="campaign">Everyone in the campaign</option>
            <option value="dm_only">Only me and the DM</option>
          </select>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" variant="gold">Create page</Button>
        </div>
      </form>
    </div>
  );
}
