import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { RaceStepClient } from "./race-step-client";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { saveBuilderStep } from "../step-actions";

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

  const atomicSaving = characterCreationUIEnabled();
  const savedClasses = character.choices !== null && typeof character.choices === "object" && !Array.isArray(character.choices)
    ? character.choices.classes : undefined;
  if (atomicSaving && (!Array.isArray(savedClasses) || savedClasses.length === 0)) {
    redirect(`/characters/${id}/builder/first-class`);
  }

  const systemId = character.system_id;

  const [raceContent, subraceContent, traitContent, contentSnapshot, languages] =
    await Promise.all([
      getContentByType(systemId, "race", true),
      getContentByType(systemId, "subrace", true),
      // Traits resolve race choices such as Dwarf tool proficiency.
      getContentByType(systemId, "trait", true),
      getCharacterContentRefSnapshot(id),
      getContentByType(systemId, "language", true),
    ]);

  return (
    <RaceStepClient
      characterId={id}
      character={character}
      races={raceContent}
      subraces={subraceContent}
      traits={traitContent}
      availableLanguages={languages.map(language => language.slug)}
      contentRefs={contentSnapshot.refs}
      asiEvidence={contentSnapshot.asiEvidence}
      schema={character.game_systems?.schema_definition}
      saveAction={atomicSaving ? saveBuilderStep.bind(null, user.id, id) : undefined}
    />
  );
}
