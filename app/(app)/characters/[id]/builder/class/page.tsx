import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
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

  const [classContent, subclassContent, featureContent, spells, contentRefs] =
    await Promise.all([
      getContentByType(systemId, "class"),
      getContentByType(systemId, "subclass"),
      getContentByType(systemId, "feature"),
      getContentByType(systemId, "spell"),
      getContentRefsByCharacter(id),
    ]);

  return (
    <ClassStepClient
      characterId={id}
      character={character}
      classes={classContent}
      subclasses={subclassContent}
      features={featureContent}
      feats={[]}
      spells={spells}
      contentRefs={contentRefs}
      schema={character.game_systems?.schema_definition}
    />
  );
}
