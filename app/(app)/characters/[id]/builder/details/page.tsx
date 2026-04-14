import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DetailsStepClient } from "./details-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DetailsStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[DetailsStepPage] Error:", characterError.message);
  }

  if (!character || character.user_id !== user.id) notFound();

  // Fetch content names for the summary display
  const classChoices = character.choices?.classes ?? [];
  const raceSlug = character.choices?.race;
  const subraceSlug = character.choices?.subrace;
  const backgroundSlug = character.choices?.background;

  // Fetch race, background names
  const slugsToFetch = [raceSlug, subraceSlug, backgroundSlug].filter(Boolean);
  let contentNames: Record<string, string> = {};

  if (slugsToFetch.length > 0) {
    const { data: contentRows } = await supabase
      .from("content_definitions")
      .select("slug, name")
      .eq("system_id", character.system_id)
      .in("slug", slugsToFetch);

    if (contentRows) {
      contentNames = Object.fromEntries(contentRows.map((r) => [r.slug, r.name]));
    }
  }

  // Fetch class names
  if (classChoices.length > 0) {
    const { data: classRows } = await supabase
      .from("content_definitions")
      .select("slug, name")
      .eq("system_id", character.system_id)
      .eq("content_type", "class")
      .in("slug", classChoices.map((c: { slug: string }) => c.slug));

    if (classRows) {
      for (const row of classRows) {
        contentNames[row.slug] = row.name;
      }
    }
  }

  return (
    <DetailsStepClient
      characterId={id}
      character={character}
      contentNames={contentNames}
    />
  );
}
