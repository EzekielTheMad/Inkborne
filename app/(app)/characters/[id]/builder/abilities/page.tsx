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

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  const { data: contentRefs } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  return (
    <AbilitiesStepClient
      characterId={id}
      character={character}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
