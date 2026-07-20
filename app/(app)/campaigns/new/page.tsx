import Link from "next/link";
import { redirect } from "next/navigation";
import { createCampaign } from "@/app/(app)/campaigns/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

interface NewCampaignPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewCampaignPage({ searchParams }: NewCampaignPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: systems } = await supabase
    .from("game_systems")
    .select("id, name")
    .eq("status", "published")
    .order("name");

  const error =
    query.error === "invalid_input"
      ? "Check the campaign name and game system."
      : query.error === "create_failed"
        ? "The campaign could not be created. Try again."
        : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="j-folio">A new chronicle</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
          Begin a campaign
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You will be the DM and owner. The game system cannot be changed after creation.
        </p>
      </div>

      <form action={createCampaign} className="j-card-paper space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input id="campaign-name" name="name" maxLength={100} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaign-system">Game system</Label>
          <select
            id="campaign-system"
            name="system_id"
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            <option value="">Choose a game system</option>
            {(systems ?? []).map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaign-description">Opening note</Label>
          <textarea
            id="campaign-description"
            name="description"
            maxLength={2000}
            rows={5}
            placeholder="What is this campaign about?"
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Link href="/campaigns" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" variant="gold">Create campaign</Button>
        </div>
      </form>
    </div>
  );
}
