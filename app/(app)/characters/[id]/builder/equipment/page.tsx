import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { EquipmentStepClient } from "./equipment-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EquipmentStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  console.log("[EquipmentStepPage] Fetching character:", id);
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (characterError) {
    console.error("[EquipmentStepPage] Error fetching character:", characterError.message, characterError.details, characterError.hint);
  }

  if (!character || character.user_id !== user.id) notFound();

  // Load class content to get starting equipment bundles
  const classSlug = character.choices?.classes?.[0]?.slug;
  let classContent = null;
  if (classSlug) {
    console.log("[EquipmentStepPage] Fetching class content for slug:", classSlug);
    const { data, error: classError } = await supabase
      .from("content_definitions")
      .select("id, name, slug, data")
      .eq("system_id", character.system_id)
      .eq("content_type", "class")
      .eq("slug", classSlug)
      .single();
    if (classError) {
      console.error("[EquipmentStepPage] Error fetching class content:", classError.message, classError.details, classError.hint);
    }
    classContent = data;
  }

  return (
    <EquipmentStepClient
      characterId={id}
      character={character}
      classContent={classContent}
    />
  );
}
