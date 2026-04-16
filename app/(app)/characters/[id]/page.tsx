import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { evaluate } from "@/lib/engine/evaluator";
import type { StructuredSources } from "@/lib/engine/evaluator";
import { initializeState } from "@/lib/sheet/helpers";
import { CharacterPageClient } from "@/components/character/character-page-client";
import type { Effect } from "@/lib/types/effects";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CharacterPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const character = await getCharacterWithSystem(id).catch(() => null);
  if (!character) notFound();

  const isOwner = character.user_id === user.id;

  // Determine if current user is DM of the campaign
  let isDm = false;
  if (character.campaign_id) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", character.campaign_id)
      .single();
    if (campaign) {
      isDm = campaign.owner_id === user.id;
    }
  }

  // Fetch content refs for sheet evaluation
  const contentRefs = await getContentRefsByCharacter(id).catch(() => []);

  // Fetch inventory
  const { data: inventoryRows } = await supabase
    .from("character_inventory")
    .select("*, content_definitions(id, name, slug, content_type, data, effects)")
    .eq("character_id", id)
    .order("sort_order")
    .order("name");

  // Fetch class features at the character's current levels
  const classChoices = character.choices?.classes ?? [];
  let classFeatures: Array<{ effects: Effect[]; data: Record<string, unknown> }> = [];

  if (classChoices.length > 0) {
    const { data: featureRows } = await supabase
      .from("content_definitions")
      .select("effects, data")
      .eq("system_id", character.system_id)
      .eq("content_type", "feature")
      .in("data->>class", classChoices.map((c: { slug: string }) => c.slug));

    if (featureRows) {
      classFeatures = featureRows.filter((f) => {
        const featureClass = f.data?.class as string | undefined;
        const featureLevel = f.data?.level as number | undefined;
        const featureSubclass = f.data?.subclass as string | null | undefined;
        if (!featureClass || featureLevel == null) return false;
        const classEntry = classChoices.find((c: { slug: string }) => c.slug === featureClass);
        if (!classEntry || featureLevel > classEntry.level) return false;
        if (featureSubclass) return classEntry.subclass === featureSubclass;
        return true;
      });
    }
  }

  // Collect all effects
  const allEffects: Effect[] = [
    ...contentRefs.flatMap((ref) => ref.content_definitions?.effects ?? []),
    ...classFeatures.flatMap((f) => f.effects ?? []),
  ];

  // Build structured sources
  const raceRef = contentRefs.find((r) => r.content_definitions?.content_type === "race");
  const classRef = contentRefs.find((r) => r.content_definitions?.content_type === "class");
  const featureRefs = contentRefs.filter((r) => r.content_definitions?.content_type === "feature");

  const structuredSources: StructuredSources = {
    raceData: raceRef?.content_definitions?.data as StructuredSources["raceData"],
    classData: classRef?.content_definitions?.data as StructuredSources["classData"],
    featureData: [
      ...featureRefs.map((r) => r.content_definitions?.data as NonNullable<StructuredSources["featureData"]>[number]),
      ...classFeatures.map((f) => f.data as NonNullable<StructuredSources["featureData"]>[number]),
    ].filter(Boolean),
    level: character.level,
  };

  // Run expression engine
  const baseStatsWithLevel = { ...character.base_stats, level: character.level };
  const schema = character.game_systems.schema_definition;
  const evalResult = evaluate(baseStatsWithLevel, allEffects, schema, structuredSources, character.state as Record<string, unknown>);

  const maxHp = evalResult.computed.hit_points ?? 0;
  const initialState = initializeState(character.state, maxHp);

  const hasSheet = character.choices?.classes && character.choices.classes.length > 0;

  return (
    <CharacterPageClient
      character={character}
      schema={schema}
      evalResult={evalResult}
      contentRefs={contentRefs}
      initialState={initialState}
      maxHp={maxHp}
      allEffects={allEffects}
      baseStatsWithLevel={baseStatsWithLevel}
      structuredSources={structuredSources}
      isOwner={isOwner}
      isDm={isDm}
      hasSheet={hasSheet ?? false}
      initialInventory={inventoryRows ?? []}
    />
  );
}
