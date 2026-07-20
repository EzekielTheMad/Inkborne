import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { BackgroundStepClient } from "./background-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BackgroundStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[BackgroundStepPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[BackgroundStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();

  const [backgroundContent, contentRefs, languages] = await Promise.all([
    getContentByType(character.system_id, "background"),
    getContentRefsByCharacter(id),
    // Used to resolve the "all_languages" choice.
    getContentByType(character.system_id, "language"),
  ]);

  return (
    <BackgroundStepClient
      characterId={id}
      character={character}
      backgrounds={backgroundContent}
      contentRefs={contentRefs}
      schema={character.game_systems?.schema_definition}
      availableLanguages={languages.map((language) => language.slug)}
    />
  );
}
