import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
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

  const [raceContent, subraceContent, traitContent, contentRefs] =
    await Promise.all([
      getContentByType(systemId, "race"),
      getContentByType(systemId, "subrace"),
      // Traits resolve race choices such as Dwarf tool proficiency.
      getContentByType(systemId, "trait"),
      getContentRefsByCharacter(id),
    ]);

  return (
    <RaceStepClient
      characterId={id}
      character={character}
      races={raceContent}
      subraces={subraceContent}
      traits={traitContent}
      contentRefs={contentRefs}
      schema={character.game_systems?.schema_definition}
    />
  );
}
