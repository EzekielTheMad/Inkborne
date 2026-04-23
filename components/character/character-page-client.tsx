"use client";

import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult, StructuredSources } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem } from "@/lib/types/inventory";
import type { CharacterSpell } from "@/lib/types/spells";
import type { ClassContentData } from "@/lib/character/character-context";
import { CharacterProvider } from "@/lib/character/character-context";
import { CharacterShell } from "@/components/character/character-shell";

interface CharacterPageClientProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  initialState: CharacterState;
  maxHp: number;
  allEffects: Effect[];
  baseStatsWithLevel: Record<string, number>;
  structuredSources: StructuredSources;
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  initialInventory: InventoryItem[];
  initialSpells: CharacterSpell[];
  classData: ClassContentData;
}

export function CharacterPageClient(props: CharacterPageClientProps) {
  const {
    character,
    schema,
    contentRefs,
    initialState,
    maxHp,
    allEffects,
    baseStatsWithLevel,
    structuredSources,
    isOwner,
    isDm,
    hasSheet,
    initialInventory,
    initialSpells,
    classData,
  } = props;

  return (
    <CharacterProvider
      character={character}
      schema={schema}
      contentRefs={contentRefs}
      initialState={initialState}
      initialInventory={initialInventory}
      allEffects={allEffects}
      baseStatsWithLevel={baseStatsWithLevel}
      structuredSources={structuredSources}
      isOwner={isOwner}
      isDm={isDm}
      hasSheet={hasSheet}
      maxHp={maxHp}
      initialSpells={initialSpells}
      classData={classData}
    >
      <CharacterShell />
    </CharacterProvider>
  );
}
