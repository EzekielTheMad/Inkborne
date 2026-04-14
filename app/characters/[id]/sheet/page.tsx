import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { evaluate } from "@/lib/engine/evaluator";
import type { StructuredSources } from "@/lib/engine/evaluator";
import { initializeState } from "@/lib/sheet/helpers";
import { SheetClient } from "@/components/sheet/sheet-client";
import type { Effect } from "@/lib/types/effects";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CharacterSheetPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  console.log("[CharacterSheetPage] Fetching character:", id);
  const character = await getCharacterWithSystem(id).catch((err) => {
    console.error("[CharacterSheetPage] Error fetching character:", err?.message, err?.details, err?.hint);
    return null;
  });
  if (!character) notFound();

  // Only the character owner may view the sheet
  if (character.user_id !== user.id) notFound();

  console.log("[CharacterSheetPage] Fetching content refs for character:", id);
  const contentRefs = await getContentRefsByCharacter(id).catch((err) => {
    console.error("[CharacterSheetPage] Error fetching content refs:", err?.message, err?.details, err?.hint);
    return [];
  });

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

        // Find the matching class entry to check level
        const classEntry = classChoices.find((c: { slug: string }) => c.slug === featureClass);
        if (!classEntry || featureLevel > classEntry.level) return false;

        // Only include features that match the selected subclass (or have no subclass)
        if (featureSubclass) {
          return classEntry.subclass === featureSubclass;
        }
        return true;
      });
    }
  }

  // Collect all effects from content refs + class features
  const allEffects: Effect[] = [
    ...contentRefs.flatMap((ref) => ref.content_definitions?.effects ?? []),
    ...classFeatures.flatMap((f) => f.effects ?? []),
  ];

  // Build structured sources from content ref data for Phase 1 aggregation
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

  // Run expression engine server-side
  const baseStatsWithLevel = { ...character.base_stats, level: character.level };
  const schema = character.game_systems.schema_definition;
  const evalResult = evaluate(baseStatsWithLevel, allEffects, schema, structuredSources, character.state as Record<string, unknown>);

  // Initialize play state with defaults
  const maxHp = evalResult.computed.hit_points ?? 0;
  const initialState = initializeState(character.state, maxHp);

  return (
    <SheetClient
      character={character}
      schema={schema}
      evalResult={evalResult}
      contentRefs={contentRefs}
      initialState={initialState}
      maxHp={maxHp}
      allEffects={allEffects}
      baseStatsWithLevel={baseStatsWithLevel}
      structuredSources={structuredSources}
    />
  );
}
