import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import { isCompendiumCategory } from "@/lib/compendium/catalog";
import { getCompendiumEntry } from "@/lib/supabase/compendium-server";
import { createClient } from "@/lib/supabase/server";

interface CompendiumEntryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    category?: string | string[];
    returnTo?: string | string[];
  }>;
}

const entryIdSchema = z.string().uuid();

export default async function CompendiumEntryPage({
  params,
  searchParams,
}: CompendiumEntryPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsedId = entryIdSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();

  const entry = await getCompendiumEntry(parsedId.data);
  if (!entry) notFound();

  const query = await searchParams;
  const rawCategory = query.category;
  const category = typeof rawCategory === "string" && isCompendiumCategory(rawCategory)
    ? rawCategory
    : null;
  const rawReturnTo = query.returnTo;
  const returnHref = typeof rawReturnTo === "string"
    && rawReturnTo.length <= 2_048
    && (rawReturnTo === "/library" || rawReturnTo.startsWith("/library?"))
    ? rawReturnTo
    : category
      ? `/library?category=${encodeURIComponent(category)}`
      : "/library";

  return <CompendiumDetail entry={entry} userId={user.id} returnHref={returnHref} />;
}
