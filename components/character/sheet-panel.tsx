"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatRibbon } from "@/components/sheet/stat-ribbon";
import { SavingThrows } from "@/components/sheet/saving-throws";
import { PassiveSenses } from "@/components/sheet/passive-senses";
import { Defenses } from "@/components/sheet/defenses";
import { Conditions } from "@/components/sheet/conditions";
import { SkillsList } from "@/components/sheet/skills-list";
import { Proficiencies } from "@/components/sheet/proficiencies";
import { ContentTabs } from "@/components/sheet/content-tabs";
import { QuickNotes } from "@/components/sheet/quick-notes";
import { ActivationToggles } from "@/components/sheet/activation-toggles";
import { MobileSheet } from "@/components/sheet/mobile-sheet";
import { ResourcesWidget } from "@/components/sheet/resources-widget";
import { ActiveEffectsWidget } from "@/components/sheet/active-effects-widget";
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
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-primary/10">
            <Sparkles className="size-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Let&apos;s build your character</h2>
          <p className="text-sm text-muted-foreground">
            {character.name} doesn&apos;t have a sheet yet. Walk through the builder to pick a
            race, class, abilities, background, and starting equipment.
          </p>
          <Link href={`/characters/${character.id}/builder`}>
            <Button size="lg" className="mt-2">
              <Sparkles className="size-4 mr-2" />
              Start Building
            </Button>
          </Link>
        </div>
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
          <ResourcesWidget />
          <ActiveEffectsWidget />
          <ActivationToggles
            toggles={availableToggles}
            onToggle={(key, active) => patchState({ [key]: active })}
          />
          <Conditions
            conditions={state.conditions ?? []}
            exhaustion={(state.exhaustion as number | undefined) ?? 0}
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
