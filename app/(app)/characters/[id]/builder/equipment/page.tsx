import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
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
  const classesPromise = getContentByType(character.system_id, "class");

  // Load background content — backgrounds grant starting equipment too
  const backgroundSlug = character.choices?.background;
  const backgroundsPromise = getContentByType(character.system_id, "background");

  const [classes, backgrounds, weapons, armor, items] = await Promise.all([
    classesPromise,
    backgroundsPromise,
    getContentByType(character.system_id, "weapon"),
    getContentByType(character.system_id, "armor"),
    getContentByType(character.system_id, "item"),
  ]);

  const classContent = classes.find((entry) => entry.slug === classSlug) ?? null;
  const backgroundContent =
    backgrounds.find((entry) => entry.slug === backgroundSlug) ?? null;

  const catalog: EquipmentCatalogItem[] = [...weapons, ...armor, ...items].map((row) => {
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
