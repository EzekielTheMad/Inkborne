import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { BackgroundStepClient } from "./background-step-client";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { saveBuilderStep } from "../step-actions";

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

  const atomicSaving = characterCreationUIEnabled();
  const savedClasses = character.choices !== null && typeof character.choices === "object" && !Array.isArray(character.choices)
    ? character.choices.classes : undefined;
  if (atomicSaving && (!Array.isArray(savedClasses) || savedClasses.length === 0)) {
    redirect(`/characters/${id}/builder/first-class`);
  }

  const [backgroundContent, contentSnapshot, languages] = await Promise.all([
    getContentByType(character.system_id, "background"),
    getCharacterContentRefSnapshot(id),
    // Used to resolve the "all_languages" choice.
    getContentByType(character.system_id, "language"),
  ]);

  return (
    <BackgroundStepClient
      characterId={id}
      character={character}
      backgrounds={backgroundContent}
      contentRefs={contentSnapshot.refs}
      asiEvidence={contentSnapshot.asiEvidence}
      schema={character.game_systems?.schema_definition}
      availableLanguages={languages.map((language) => language.slug)}
      saveAction={atomicSaving ? saveBuilderStep.bind(null, user.id, id) : undefined}
    />
  );
}
