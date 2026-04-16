"use client";

import { useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { evaluate } from "@/lib/engine/evaluator";
import type { EvaluationResult, StructuredSources } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem, Currency } from "@/lib/types/inventory";
import { DEFAULT_CURRENCY } from "@/lib/types/inventory";
import { addInventoryItem, updateInventoryItem, removeInventoryItem, unequipAllArmor } from "@/lib/supabase/inventory";
import { generateArmorEffects } from "@/lib/inventory/armor-effects";
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
  inventory: InventoryItem[];
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
  inventory,
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

  const [localInventory, setLocalInventory] = useState<InventoryItem[]>(inventory);

  async function handleAddItem(item: { content_id: string | null; name: string; content_type: string }) {
    const newItem = await addInventoryItem(character.id, item);
    if (newItem) {
      setLocalInventory((prev) => [...prev, newItem]);
    }
  }

  async function handleUpdateItem(itemId: string, updates: Partial<Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes">>) {
    // If equipping armor (non-shield), unequip other armor first
    if (updates.equipped === true) {
      const item = localInventory.find((i) => i.id === itemId);
      const itemData = item?.content_definitions?.data as Record<string, unknown> | undefined;
      if (item?.content_type === "armor" && itemData?.armor_category !== "Shield") {
        await unequipAllArmor(character.id);
        setLocalInventory((prev) =>
          prev.map((i) =>
            i.content_type === "armor" && i.id !== itemId && (i.content_definitions?.data as Record<string, unknown>)?.armor_category !== "Shield"
              ? { ...i, equipped: false }
              : i
          )
        );
      }
    }
    await updateInventoryItem(itemId, updates);
    setLocalInventory((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
  }

  async function handleRemoveItem(itemId: string) {
    await removeInventoryItem(itemId);
    setLocalInventory((prev) => prev.filter((i) => i.id !== itemId));
  }

  function handleCurrencyChange(newCurrency: Currency) {
    patchState({ currency: newCurrency });
  }

  // AC effects from equipped armor
  const equippedArmorEffects = useMemo(() => {
    const equippedArmor = localInventory.find(
      (i) => i.equipped && i.content_type === "armor" &&
      (i.content_definitions?.data as Record<string, unknown>)?.armor_category !== "Shield"
    );
    if (!equippedArmor) return [];
    return generateArmorEffects(equippedArmor.content_definitions?.data as any);
  }, [localInventory]);

  // Derive equipped_armor state from inventory
  const derivedState = useMemo(() => {
    const equippedArmor = localInventory.find(
      (i) => i.equipped && i.content_type === "armor" &&
      (i.content_definitions?.data as Record<string, unknown>)?.armor_category !== "Shield"
    );
    const hasShield = localInventory.some(
      (i) => i.equipped && (i.content_definitions?.data as Record<string, unknown>)?.armor_category === "Shield"
    );
    const armorCategory = equippedArmor
      ? String((equippedArmor.content_definitions?.data as Record<string, unknown>)?.armor_category ?? "none").toLowerCase()
      : "none";
    return {
      ...state,
      equipped_armor: armorCategory,
      shield_equipped: hasShield,
    };
  }, [localInventory, state]);

  const evalResult = useMemo(() => {
    const combinedEffects = [...allEffects, ...equippedArmorEffects];
    return evaluate(baseStatsWithLevel, combinedEffects, schema, structuredSources, derivedState as Record<string, unknown>);
  }, [baseStatsWithLevel, allEffects, equippedArmorEffects, schema, structuredSources, derivedState]);

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
                    inventory={localInventory}
                    currency={(state.currency as Currency) ?? DEFAULT_CURRENCY}
                    systemId={character.system_id}
                    strengthScore={evalResult.stats.strength ?? 10}
                    onAddItem={handleAddItem}
                    onUpdateItem={handleUpdateItem}
                    onRemoveItem={handleRemoveItem}
                    onCurrencyChange={handleCurrencyChange}
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
                  inventory={localInventory}
                  currency={(state.currency as Currency) ?? DEFAULT_CURRENCY}
                  systemId={character.system_id}
                  strengthScore={evalResult.stats.strength ?? 10}
                  onAddItem={handleAddItem}
                  onUpdateItem={handleUpdateItem}
                  onRemoveItem={handleRemoveItem}
                  onCurrencyChange={handleCurrencyChange}
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
