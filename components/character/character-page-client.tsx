"use client";

import { useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { evaluate } from "@/lib/engine/evaluator";
import type { EvaluationResult, StructuredSources } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import { updateCharacterState } from "@/lib/sheet/update-state";
import { CharacterHeader } from "@/components/sheet/character-header";
import { StatRibbon } from "@/components/sheet/stat-ribbon";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { PassiveSenses } from "@/components/sheet/passive-senses";
import { Defenses } from "@/components/sheet/defenses";
import { Conditions } from "@/components/sheet/conditions";
import { DeathSaves } from "@/components/sheet/death-saves";
import { SkillsList } from "@/components/sheet/skills-list";
import { Proficiencies } from "@/components/sheet/proficiencies";
import { ContentTabs } from "@/components/sheet/content-tabs";
import { QuickNotes } from "@/components/sheet/quick-notes";
import { EquipmentState } from "@/components/sheet/equipment-state";
import { ActivationToggles } from "@/components/sheet/activation-toggles";
import { MobileSheet } from "@/components/sheet/mobile-sheet";
import { NarrativeTab } from "@/components/narrative/narrative-tab";

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
}

export function CharacterPageClient({
  character,
  schema,
  evalResult: serverEvalResult,
  contentRefs,
  initialState,
  maxHp,
  allEffects,
  baseStatsWithLevel,
  structuredSources,
  isOwner,
  isDm,
  hasSheet,
}: CharacterPageClientProps) {
  const [state, setState] = useState<CharacterState>(initialState);
  const [portraitUrl, setPortraitUrl] = useState<string | undefined>(
    character.narrative?.portrait_url as string | undefined,
  );
  const [portraitCrop, setPortraitCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(
    character.narrative?.portrait_crop as { x: number; y: number; width: number; height: number } | null ?? null,
  );

  const patchState = useCallback(
    async (patch: Partial<CharacterState>) => {
      setState((prev) => ({ ...prev, ...patch }));
      try {
        await updateCharacterState(character.id, patch);
      } catch (err) {
        console.error("Failed to save state:", err);
      }
    },
    [character.id],
  );

  const evalResult = useMemo(() => {
    return evaluate(baseStatsWithLevel, allEffects, schema, structuredSources, state as Record<string, unknown>);
  }, [baseStatsWithLevel, allEffects, schema, structuredSources, state]);

  const availableToggles = useMemo(() => {
    const toggles: Array<{ key: string; label: string; active: boolean }> = [];
    const hasBarbarian = character.choices?.classes?.some(
      (c: { slug: string }) => c.slug === "barbarian",
    );
    if (hasBarbarian) {
      toggles.push({
        key: "rage_active",
        label: "Rage",
        active: (state.rage_active as boolean) ?? false,
      });
    }
    return toggles;
  }, [character.choices, state]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header — persistent across tabs */}
      <div className="hidden md:block">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={() =>
            patchState({ inspiration: !(state.inspiration ?? false) })
          }
          portraitUrl={portraitUrl}
          portraitCrop={portraitCrop}
        />
      </div>
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

      {/* Tab switcher */}
      <Tabs defaultValue="sheet" className="flex-1 flex flex-col">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger
              value="sheet"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
            >
              Character Sheet
            </TabsTrigger>
            <TabsTrigger
              value="narrative"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
            >
              Narrative
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Sheet Tab */}
        <TabsContent value="sheet" className="flex-1 flex flex-col mt-0">
          {hasSheet ? (
            <>
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
                <div className="space-y-4">
                  <SavingThrows schema={schema} evalResult={evalResult} />
                  <PassiveSenses schema={schema} evalResult={evalResult} />
                  <Defenses evalResult={evalResult} />
                  <EquipmentState
                    equippedArmor={(state.equipped_armor as string) ?? "none"}
                    shieldEquipped={(state.shield_equipped as boolean) ?? false}
                    onArmorChange={(armor) => patchState({ equipped_armor: armor as CharacterState["equipped_armor"] })}
                    onShieldChange={(shield) => patchState({ shield_equipped: shield })}
                  />
                  <ActivationToggles
                    toggles={availableToggles}
                    onToggle={(key, active) => patchState({ [key]: active })}
                  />
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
                  <QuickNotes state={state} patchState={patchState} />
                </div>
                <div className="space-y-4">
                  <SkillsList schema={schema} evalResult={evalResult} />
                </div>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <ContentTabs
                    character={character}
                    schema={schema}
                    evalResult={evalResult}
                    contentRefs={contentRefs}
                    state={state}
                    patchState={patchState}
                  />
                </div>
              </div>

              {/* Mobile layout */}
              <div className="md:hidden flex-1 flex flex-col">
                <MobileSheet
                  character={character}
                  schema={schema}
                  evalResult={evalResult}
                  contentRefs={contentRefs}
                  state={state}
                  patchState={patchState}
                  maxHp={maxHp}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-3">
                <p className="text-lg font-medium">Character not built yet</p>
                <p className="text-sm text-muted-foreground">
                  Complete the builder to unlock the character sheet.
                </p>
                <a href={`/characters/${character.id}/builder`}>
                  <button className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
                    Open Builder
                  </button>
                </a>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Narrative Tab */}
        <TabsContent value="narrative" className="flex-1 mt-0">
          <div className="p-4 max-w-4xl mx-auto">
            <NarrativeTab
              character={character}
              isOwner={isOwner}
              isDm={isDm}
              onPortraitChange={(url) => setPortraitUrl(url ?? undefined)}
              onCropChange={(crop) => setPortraitCrop(crop)}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
