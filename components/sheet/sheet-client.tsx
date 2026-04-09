"use client";

import { useState, useCallback } from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { CharacterHeader } from "@/components/sheet/character-header";
import { StatRibbon } from "@/components/sheet/stat-ribbon";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { PassiveSenses } from "@/components/sheet/passive-senses";
import { Conditions } from "@/components/sheet/conditions";
import { DeathSaves } from "@/components/sheet/death-saves";
import { SkillsList } from "@/components/sheet/skills-list";
import { Proficiencies } from "@/components/sheet/proficiencies";

interface SheetClientProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  contentRefs: ContentRefWithContent[];
  initialState: CharacterState;
  maxHp: number;
}

export function SheetClient({
  character,
  schema,
  evalResult,
  contentRefs,
  initialState,
  maxHp,
}: SheetClientProps) {
  const [state, setState] = useState<CharacterState>(initialState);

  const patchState = useCallback(
    async (patch: Partial<CharacterState>) => {
      // Optimistic local update
      setState((prev) => ({ ...prev, ...patch }));
      // Persist to database
      try {
        await updateCharacterState(character.id, patch);
      } catch (err) {
        console.error("Failed to save state:", err);
      }
    },
    [character.id],
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={() =>
            patchState({ inspiration: !(state.inspiration ?? false) })
          }
        />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={() =>
            patchState({ inspiration: !(state.inspiration ?? false) })
          }
          mobile
        />
      </div>

      {/* Stat Ribbon */}
      <div className="px-4 py-3 border-b border-border">
        <StatRibbon
          schema={schema}
          evalResult={evalResult}
          state={state}
          maxHp={maxHp}
          patchState={patchState}
        />
      </div>

      {/* Desktop three-column layout */}
      <div className="hidden md:grid grid-cols-[280px_1fr_1fr] gap-4 flex-1 p-4">
        {/* Left column */}
        <div className="space-y-4">
          <SavingThrows schema={schema} evalResult={evalResult} />
          <PassiveSenses schema={schema} evalResult={evalResult} />
          <Conditions
            conditions={state.conditions ?? []}
            patchState={patchState}
          />
          <DeathSaves
            currentHp={state.current_hp ?? 0}
            deathSaves={state.death_saves ?? { successes: 0, failures: 0 }}
            patchState={patchState}
          />
          <Proficiencies grants={evalResult.grants} contentRefs={contentRefs} />
        </div>

        {/* Center column */}
        <div className="space-y-4">
          <SkillsList schema={schema} evalResult={evalResult} />
        </div>

        {/* Right column placeholder */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground italic">
              Actions, spells, features — coming soon ({contentRefs.length} items)
            </p>
          </div>
        </div>
      </div>

      {/* Mobile swipeable tabs placeholder */}
      <div className="md:hidden flex-1 p-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground italic">
            Mobile tabs — coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
