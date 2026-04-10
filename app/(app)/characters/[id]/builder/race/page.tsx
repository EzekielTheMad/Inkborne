import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { RaceStepClient } from "./race-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RaceStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[RaceStepPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[RaceStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();

  const systemId = character.system_id;

  console.log("[RaceStepPage] Fetching race content for system:", systemId);
  const { data: raceContent, error: raceError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "race")
    .order("name");

  if (raceError) {
    console.error("[RaceStepPage] Error fetching races:", raceError.message, raceError.details, raceError.hint);
  }

  const { data: subraceContent, error: subraceError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "subrace")
    .order("name");

  if (subraceError) {
    console.error("[RaceStepPage] Error fetching subraces:", subraceError.message, subraceError.details, subraceError.hint);
  }

  const { data: contentRefs, error: contentRefsError } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  if (contentRefsError) {
    console.error("[RaceStepPage] Error fetching content refs:", contentRefsError.message, contentRefsError.details, contentRefsError.hint);
  }

  return (
    <RaceStepClient
      characterId={id}
      character={character}
      races={raceContent ?? []}
      subraces={subraceContent ?? []}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
