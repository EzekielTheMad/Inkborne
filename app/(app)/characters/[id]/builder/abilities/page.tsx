import { createClient } from "@/lib/supabase/server";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
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

  const contentRefs = await getContentRefsByCharacter(id);

  return (
    <AbilitiesStepClient
      characterId={id}
      character={character}
      contentRefs={contentRefs}
      schema={character.game_systems?.schema_definition}
    />
  );
}
