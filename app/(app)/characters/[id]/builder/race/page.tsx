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

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  const systemId = character.system_id;

  const { data: raceContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "race")
    .order("name");

  const { data: subraceContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "subrace")
    .order("name");

  const { data: contentRefs } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

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
