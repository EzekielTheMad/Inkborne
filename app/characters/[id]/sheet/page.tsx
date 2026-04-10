import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSystem } from "@/lib/supabase/characters";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { evaluate } from "@/lib/engine/evaluator";
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

  // Run expression engine server-side
  const baseStatsWithLevel = { ...character.base_stats, level: character.level };
  const schema = character.game_systems.schema_definition;
  const evalResult = evaluate(baseStatsWithLevel, allEffects, schema);

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
