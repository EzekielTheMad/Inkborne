import { createClient } from "@/lib/supabase/server";
import { getContentByType } from "@/lib/supabase/content-definitions";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { redirect, notFound } from "next/navigation";
import { EquipmentStepClient } from "./equipment-step-client";
import { startingEquipmentReceiptSchema } from "@/lib/builder/starting-equipment-contract";
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

  // Owner-policy read preserves terminal recovery on reload even with disabled
  // new awards, missing pins, consumed inventory or an unavailable catalog.
  const grant = await supabase.from("character_starting_grants")
    .select("status, receipt").eq("character_id", id).eq("grant_kind", "starting_equipment").maybeSingle();
  if (grant.error && !["42P01", "PGRST205"].includes(grant.error.code)) {
    throw new Error("The saved equipment award could not be read. Reload before continuing.");
  }
  if (grant.data?.status === "awarded" || grant.data?.status === "inherited_completion") {
    const receipt = startingEquipmentReceiptSchema.safeParse(grant.data.receipt);
    if (grant.data.status === "awarded" && !receipt.success) throw new Error("The saved equipment award could not be read.");
    const completion = grant.data.status === "awarded" && receipt.success
      ? { status: "awarded" as const, receipt: receipt.data }
      : { status: "inherited_completion" as const };
    return <EquipmentStepClient characterId={id} character={character} classContent={null} backgroundContent={null} catalog={[]} completion={completion} />;
  }

  // Starting equipment comes from the exact class/background snapshots pinned
  // to this character. Catalog items remain current because the player is
  // making a new equipment selection now.
  const classSlug = character.choices?.classes?.[0]?.slug;
  const backgroundSlug = character.choices?.background;

  const [contentRefs, weapons, armor, items] = await Promise.all([
    getContentRefsByCharacter(id, { requireCompleteSnapshots: true }),
    getContentByType(character.system_id, "weapon"),
    getContentByType(character.system_id, "armor"),
    getContentByType(character.system_id, "item"),
  ]);

  const classContent =
    contentRefs
      .map((ref) => ref.content_definitions)
      .find(
        (entry) =>
          entry.content_type === "class" && entry.slug === classSlug,
      ) ?? null;
  const backgroundContent =
    contentRefs
      .map((ref) => ref.content_definitions)
      .find(
        (entry) =>
          entry.content_type === "background" && entry.slug === backgroundSlug,
      ) ?? null;

  const catalog: EquipmentCatalogItem[] = [...weapons, ...armor, ...items].map((row) => {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      version: row.version,
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
