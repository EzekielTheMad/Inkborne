import { BookMarked } from "lucide-react";
import { redirect } from "next/navigation";

import { CompendiumBrowser } from "@/components/compendium/compendium-browser";
import { compendiumHref, parseCompendiumQuery } from "@/lib/compendium/catalog";
import {
  listCompendiumEntries,
  listCompendiumSystems,
} from "@/lib/supabase/compendium-server";
import { createClient } from "@/lib/supabase/server";

interface LibraryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [rawQuery, systems] = await Promise.all([
    searchParams,
    listCompendiumSystems(),
  ]);

  if (systems.length === 0) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-3xl flex-col items-center justify-center text-center">
        <BookMarked className="size-8 text-accent" />
        <h1 className="j-display mt-4 text-3xl text-foreground">Library unavailable</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          No published game system is available yet. Your characters and homebrew are still safe;
          publish a system before browsing its rules.
        </p>
      </div>
    );
  }

  const parsedQuery = parseCompendiumQuery(rawQuery);
  const selectedSystem = systems.some((system) => system.id === parsedQuery.system)
    ? parsedQuery.system
    : systems[0].id;
  const query = {
    ...parsedQuery,
    system: selectedSystem,
    page: selectedSystem === parsedQuery.system ? parsedQuery.page : 1,
  };
  const result = await listCompendiumEntries(query, user.id);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (query.page > totalPages) {
    redirect(compendiumHref(query, { page: totalPages }));
  }

  return (
    <CompendiumBrowser
      systems={systems}
      query={query}
      result={result}
      userId={user.id}
    />
  );
}
