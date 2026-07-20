"use client";

import { useState } from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult, StructuredSources } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem } from "@/lib/types/inventory";
import type { CharacterSpell } from "@/lib/types/spells";
import type { RollLogEntry } from "@/lib/types/rolls";
import type { ClassContentData } from "@/lib/character/character-context";
import { CharacterProvider } from "@/lib/character/character-context";
import { CharacterShell } from "@/components/character/character-shell";
import { characterColorStyle } from "@/lib/character/character-color-style";
import type { CampaignPageBacklink } from "@/lib/campaigns/backlinks";

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
  initialRolls?: RollLogEntry[];
  classData: ClassContentData;
  campaignPageBacklinks: CampaignPageBacklink[];
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
    initialRolls,
    classData,
    campaignPageBacklinks,
  } = props;

  const [primaryColor, setPrimaryColor] = useState<string | null>(
    character.primary_color ?? null,
  );

  return (
    <div style={characterColorStyle(primaryColor)}>
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
        initialRolls={initialRolls}
        classData={classData}
        primaryColor={primaryColor}
        onPrimaryColorChange={setPrimaryColor}
      >
        <CharacterShell campaignPageBacklinks={campaignPageBacklinks} />
      </CharacterProvider>
    </div>
  );
}
