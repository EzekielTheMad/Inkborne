"use client";

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
import {
  useCharacter,
  useCharacterState,
} from "@/lib/character/character-context";

export function SheetPanel() {
  const { character, schema, contentRefs, hasSheet, evalResult, maxHp } =
    useCharacter();
  const { state, patchState } = useCharacterState();

  if (!hasSheet) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Character has no sheet yet. Complete the builder first.</p>
      </div>
    );
  }

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
      />
    </>
  );
}
