import { createClient } from "@/lib/supabase/server";
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

  console.log("[BackgroundStepPage] Fetching background content for system:", character.system_id);
  const { data: backgroundContent, error: backgroundError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", character.system_id)
    .eq("content_type", "background")
    .order("name");

  if (backgroundError) {
    console.error("[BackgroundStepPage] Error fetching backgrounds:", backgroundError.message, backgroundError.details, backgroundError.hint);
  }

  const { data: contentRefs, error: contentRefsError } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  if (contentRefsError) {
    console.error("[BackgroundStepPage] Error fetching content refs:", contentRefsError.message, contentRefsError.details, contentRefsError.hint);
  }

  // Fetch all languages for resolving "all_languages" choice
  const { data: languages } = await supabase
    .from("content_definitions")
    .select("slug, name")
    .eq("system_id", character.system_id)
    .eq("content_type", "language")
    .order("name");

  return (
    <BackgroundStepClient
      characterId={id}
      character={character}
      backgrounds={backgroundContent ?? []}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
      availableLanguages={(languages ?? []).map((l) => l.slug)}
    />
  );
}
