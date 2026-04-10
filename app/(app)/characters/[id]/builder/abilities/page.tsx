import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AbilitiesStepClient } from "./abilities-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AbilitiesStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[AbilitiesStepPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[AbilitiesStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();

  const { data: contentRefs, error: contentRefsError } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  if (contentRefsError) {
    console.error("[AbilitiesStepPage] Error fetching content refs:", contentRefsError.message, contentRefsError.details, contentRefsError.hint);
  }

  return (
    <AbilitiesStepClient
      characterId={id}
      character={character}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
