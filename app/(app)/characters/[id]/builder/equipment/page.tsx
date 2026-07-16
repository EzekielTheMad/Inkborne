import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { EquipmentStepClient } from "./equipment-step-client";
import type { EquipmentCatalogItem } from "@/lib/builder/equipment-choices";

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

  // Load class content to get starting equipment text
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

  // Load background content — backgrounds grant starting equipment too
  const backgroundSlug = character.choices?.background;
  let backgroundContent = null;
  if (backgroundSlug) {
    const { data, error: backgroundError } = await supabase
      .from("content_definitions")
      .select("id, name, slug, data")
      .eq("system_id", character.system_id)
      .eq("content_type", "background")
      .eq("slug", backgroundSlug)
      .single();
    if (backgroundError) {
      console.error("[EquipmentStepPage] Error fetching background content:", backgroundError.message, backgroundError.details, backgroundError.hint);
    }
    backgroundContent = data;
  }

  // Equipment catalog for resolving choices to real content definitions.
  // Trimmed server-side so the client payload stays small.
  const { data: catalogRows, error: catalogError } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data")
    .eq("system_id", character.system_id)
    .eq("scope", "platform")
    .in("content_type", ["weapon", "armor", "item"])
    .order("name");

  if (catalogError) {
    console.error("[EquipmentStepPage] Error fetching equipment catalog:", catalogError.message, catalogError.details, catalogError.hint);
  }

  const catalog: EquipmentCatalogItem[] = (catalogRows ?? []).map((row) => {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      content_type: row.content_type,
      weapon_category:
        typeof data.weapon_category === "string" ? data.weapon_category : null,
      weapon_range:
        typeof data.weapon_range === "string" ? data.weapon_range : null,
    };
  });

  return (
    <EquipmentStepClient
      characterId={id}
      character={character}
      classContent={classContent}
      backgroundContent={backgroundContent}
      catalog={catalog}
    />
  );
}
