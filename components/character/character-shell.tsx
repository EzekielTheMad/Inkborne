"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterHeader } from "@/components/sheet/character-header";
import { SheetPanel } from "@/components/character/sheet-panel";
import { NarrativePanel } from "@/components/character/narrative-panel";
import { ConcentrationBadge } from "@/components/sheet/spells/concentration-badge";
import { RollLayer } from "@/components/sheet/rolls/roll-layer";
import {
  useCharacter,
  useCharacterState,
  usePortrait,
} from "@/lib/character/character-context";

export function CharacterShell() {
  const { character } = useCharacter();
  const { state, patchState } = useCharacterState();
  const { portrait } = usePortrait();

  const onToggleInspiration = () =>
    patchState({ inspiration: !(state.inspiration ?? false) });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="hidden md:block">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={onToggleInspiration}
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
        />
      </div>
      <div className="md:hidden">
        <CharacterHeader
          character={character}
          inspiration={state.inspiration ?? false}
          onToggleInspiration={onToggleInspiration}
          portraitUrl={portrait.url}
          portraitCrop={portrait.crop}
          mobile
        />
      </div>

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
          <div className="ml-auto flex items-center gap-1 pr-3">
            <ConcentrationBadge />
            <RollLayer />
          </div>
        </TabsList>

        <TabsContent value="sheet" className="flex-1 flex flex-col mt-0">
          <SheetPanel />
        </TabsContent>

        <TabsContent value="narrative" className="flex-1 overflow-y-auto mt-0">
          <NarrativePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
