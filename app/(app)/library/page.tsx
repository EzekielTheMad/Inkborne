import Link from "next/link";
import { BookOpen, Plus, Sparkles, Upload } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { listOwnedHomebrewSpells } from "@/lib/supabase/homebrew-spells-server";

interface LibraryPageProps {
  searchParams: Promise<{ created?: string | string[]; updated?: string | string[] }>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const query = await searchParams;
  let spells = null;
  let loadError = false;
  try {
    spells = await listOwnedHomebrewSpells();
  } catch (error) {
    console.error("[LibraryPage] Failed to load owned homebrew spells", error);
    loadError = true;
  }

  const notice = typeof query.created === "string"
    ? "Private spell created."
    : typeof query.updated === "string"
      ? "A new spell version was saved. Existing character pins are unchanged."
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Your rules, one source of truth</p>
          <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Author homebrew that flows into the same character sheets and gameplay tools as SRD content,
            then share it with the campaigns you choose.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/library/import" className={buttonVariants({ variant: "outline" })}>
            <Upload className="size-4" />
            Import MPMB
          </Link>
          <Link href="/library/spells/new" className={buttonVariants({ variant: "gold" })}>
            <Plus className="size-4" />
            Create spell
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent" role="status">
          {notice}
        </div>
      )}

      {loadError ? (
        <div className="j-card-paper p-8 text-center" role="alert">
          <p className="font-medium text-foreground">Your library could not be loaded.</p>
          <p className="mt-2 text-sm text-muted-foreground">Refresh the page to try again.</p>
        </div>
      ) : spells?.length === 0 ? (
        <div className="j-card-paper flex flex-col items-center px-6 py-14 text-center">
          <div className="rounded-full border border-accent/30 bg-accent/10 p-3 text-accent">
            <Sparkles className="size-6" />
          </div>
          <h2 className="j-display mt-4 text-xl text-foreground">Write your first private spell</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Only you can see private homebrew. Once created, compatible characters can discover and pin an exact version.
          </p>
          <Link href="/library/spells/new" className={buttonVariants({ variant: "outline", className: "mt-5" })}>
            Begin authoring
          </Link>
        </div>
      ) : (
        <section aria-labelledby="owned-spells-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-accent" />
            <h2 id="owned-spells-heading" className="j-folio">My spells</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {spells?.map((spell) => (
              <Link
                key={spell.id}
                href={`/library/spells/${spell.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">{spell.name}</h3>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {spell.data.level === 0 ? "Cantrip" : `Level ${spell.data.level}`} · {spell.data.school}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">
                      {spell.scope === "shared"
                        ? `Shared · ${spell.sharedCampaignCount} ${spell.sharedCampaignCount === 1 ? "campaign" : "campaigns"}`
                        : "Private"}
                    </Badge>
                    <Badge variant="secondary">v{spell.version}</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {spell.data.classes.map((classSlug) => (
                    <span key={classSlug} className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                      {classSlug}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
