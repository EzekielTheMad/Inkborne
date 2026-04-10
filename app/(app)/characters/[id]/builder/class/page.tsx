import { createClient } from "@/lib/supabase/server";
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
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[ClassStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();

  const systemId = character.system_id;

  console.log("[ClassStepPage] Fetching class content for system:", systemId);
  const { data: classContent, error: classError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "class")
    .order("name");

  if (classError) {
    console.error("[ClassStepPage] Error fetching classes:", classError.message, classError.details, classError.hint);
  }

  const { data: subclassContent, error: subclassError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "subclass")
    .order("name");

  if (subclassError) {
    console.error("[ClassStepPage] Error fetching subclasses:", subclassError.message, subclassError.details, subclassError.hint);
  }

  const { data: featureContent, error: featureError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "feature")
    .order("name");

  if (featureError) {
    console.error("[ClassStepPage] Error fetching features:", featureError.message, featureError.details, featureError.hint);
  }

  const { data: contentRefs, error: contentRefsError } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  if (contentRefsError) {
    console.error("[ClassStepPage] Error fetching content refs:", contentRefsError.message, contentRefsError.details, contentRefsError.hint);
  }

  return (
    <ClassStepClient
      characterId={id}
      character={character}
      classes={classContent ?? []}
      subclasses={subclassContent ?? []}
      features={featureContent ?? []}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
