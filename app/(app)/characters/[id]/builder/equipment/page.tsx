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

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  // Load class content to get starting equipment bundles
  const classSlug = character.choices?.classes?.[0]?.slug;
  let classContent = null;
  if (classSlug) {
    const { data } = await supabase
      .from("content_definitions")
      .select("id, name, slug, data")
      .eq("system_id", character.system_id)
      .eq("content_type", "class")
      .eq("slug", classSlug)
      .single();
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
