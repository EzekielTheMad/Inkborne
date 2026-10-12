import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { ClassStepClient } from "./class-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClassStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[ClassStepPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition), campaigns (id, hp_rule)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[ClassStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();

  const systemId = character.system_id;

  const [classContent, subclassContent, featureContent, spells, contentSnapshot, languages] =
    await Promise.all([
      getContentByType(systemId, "class"),
      getContentByType(systemId, "subclass"),
      getContentByType(systemId, "feature"),
      getContentByType(systemId, "spell"),
      getCharacterContentRefSnapshot(id),
      getContentByType(systemId, "language"),
    ]);

  return (
    <ClassStepClient
      characterId={id}
      character={character}
      classes={classContent}
      subclasses={subclassContent}
      features={featureContent}
      availableLanguages={languages.map(language => language.slug)}
      feats={[]}
      spells={spells}
      contentRefs={contentSnapshot.refs}
      asiEvidence={contentSnapshot.asiEvidence}
      schema={character.game_systems?.schema_definition}
    />
  );
}
