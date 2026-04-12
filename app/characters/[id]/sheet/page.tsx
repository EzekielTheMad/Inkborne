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

  // Collect all effects from content refs
  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  // Build structured sources from content ref data for Phase 1 aggregation
  const raceRef = contentRefs.find((r) => r.content_definitions?.content_type === "race");
  const classRef = contentRefs.find((r) => r.content_definitions?.content_type === "class");
  const featureRefs = contentRefs.filter((r) => r.content_definitions?.content_type === "feature");

  const structuredSources: StructuredSources = {
    raceData: raceRef?.content_definitions?.data as StructuredSources["raceData"],
    classData: classRef?.content_definitions?.data as StructuredSources["classData"],
    featureData: featureRefs.map((r) => r.content_definitions?.data as NonNullable<StructuredSources["featureData"]>[number]).filter(Boolean),
    level: character.level,
  };

  // Run expression engine server-side
  const baseStatsWithLevel = { ...character.base_stats, level: character.level };
  const schema = character.game_systems.schema_definition;
  const evalResult = evaluate(baseStatsWithLevel, allEffects, schema, structuredSources);

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
    />
  );
}
