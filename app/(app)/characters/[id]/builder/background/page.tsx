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

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  const { data: backgroundContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", character.system_id)
    .eq("content_type", "background")
    .order("name");

  const { data: contentRefs } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  return (
    <BackgroundStepClient
      characterId={id}
      character={character}
      backgrounds={backgroundContent ?? []}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
