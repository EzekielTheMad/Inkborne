"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  useCharacter,
  useCharacterState,
  useInventory,
  usePortrait,
} from "@/lib/character/character-context";

export function CharacterShell() {
  const { character, schema, contentRefs, isOwner, isDm, hasSheet, evalResult, maxHp } =
    useCharacter();
  const { state, patchState } = useCharacterState();
  const { inventory, currency, addItem, updateItem, removeItem, setCurrency } =
    useInventory();
  const { portrait, setPortrait } = usePortrait();

  const availableToggles = (() => {
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
  })();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="hidden md:block">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={() =>
            patchState({ inspiration: !(state.inspiration ?? false) })
          }
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
        />
      </div>
      <div className="md:hidden">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={() =>
            patchState({ inspiration: !(state.inspiration ?? false) })
          }
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
          mobile
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sheet" className="flex-1 flex flex-col">
        <TabsList className="border-b bg-transparent rounded-none w-full justify-start h-auto p-0 shrink-0">
          <TabsTrigger
            value="sheet"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-4 py-2"
          >
            Character Sheet
          </TabsTrigger>
          <TabsTrigger
            value="narrative"
            className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-4 py-2"
          >
            Narrative
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sheet" className="flex-1 flex flex-col mt-0">
          {hasSheet ? (
            <>
              <div className="hidden md:block px-4 py-3 border-b border-border">
                <StatRibbon
                  schema={schema}
                  evalResult={evalResult}
                  state={state}
                  patchState={patchState}
                  maxHp={maxHp}
                />
              </div>

              <div className="hidden md:grid grid-cols-[280px_1fr_1fr] gap-4 flex-1 p-4 overflow-hidden">
                <div className="space-y-4 overflow-y-auto">
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
                <div className="overflow-y-auto">
                  <SkillsList schema={schema} evalResult={evalResult} />
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-card flex flex-col">
                  <ContentTabs
                    character={character}
                    schema={schema}
                    evalResult={evalResult}
                    contentRefs={contentRefs}
                    state={state}
                    patchState={patchState}
                    inventory={inventory}
                    currency={currency}
                    systemId={character.system_id}
                    strengthScore={evalResult.stats.strength ?? 10}
                    onAddItem={addItem}
                    onUpdateItem={updateItem}
                    onRemoveItem={removeItem}
                    onCurrencyChange={setCurrency}
                  />
                </div>
              </div>

              <MobileSheet
                character={character}
                schema={schema}
                evalResult={evalResult}
                contentRefs={contentRefs}
                state={state}
                patchState={patchState}
                maxHp={maxHp}
                inventory={inventory}
                currency={currency}
                systemId={character.system_id}
                strengthScore={evalResult.stats.strength ?? 10}
                onAddItem={addItem}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onCurrencyChange={setCurrency}
              />
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>Character has no sheet yet. Complete the builder first.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="narrative" className="flex-1 overflow-y-auto mt-0">
          <div className="max-w-4xl mx-auto p-4">
            <NarrativeTab
              character={character}
              isOwner={isOwner}
              isDm={isDm}
              onPortraitChange={(url) => setPortrait({ url: url ?? undefined })}
              onCropChange={(crop) => setPortrait({ crop })}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
