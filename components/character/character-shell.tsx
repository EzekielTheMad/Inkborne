"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterHeader } from "@/components/sheet/character-header";
import { SheetPanel } from "@/components/character/sheet-panel";
import { NarrativePanel } from "@/components/character/narrative-panel";
import { ConcentrationBadge } from "@/components/sheet/spells/concentration-badge";
import { ConcentrationPrompt } from "@/components/sheet/concentration-prompt";
import { RollLayer } from "@/components/sheet/rolls/roll-layer";
import { FirstArrival } from "@/components/sheet/first-arrival";
import styles from "./character-notebook.module.css";
import {
  useCharacter,
  useCharacterState,
  usePortrait,
} from "@/lib/character/character-context";
import type { CampaignPageBacklink } from "@/lib/campaigns/backlinks";
import type {
  CharacterRelationship,
  CharacterTimelineEvent,
} from "@/lib/types/narrative";

interface CharacterShellProps {
  campaignPageBacklinks: CampaignPageBacklink[];
  timelineEvents: CharacterTimelineEvent[];
  relationships: CharacterRelationship[];
}

export function CharacterShell({
  campaignPageBacklinks,
  timelineEvents,
  relationships,
}: CharacterShellProps) {
  const { character, hasSheet } = useCharacter();
  const { state, patchState } = useCharacterState();
  const { portrait } = usePortrait();

  const onToggleInspiration = () =>
    patchState({ inspiration: !(state.inspiration ?? false) });

  return (
    <div className={styles.shell}>
      {hasSheet && (
        <FirstArrival
          characterId={character.id}
          characterName={character.name}
          seenBefore={state.seen_sheet_first_time === true}
          onSeen={() => patchState({ seen_sheet_first_time: true })}
        />
      )}
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

      <Tabs defaultValue="sheet" className={styles.primaryTabs}>
        <TabsList className={styles.bookmarks}>
          <TabsTrigger
            value="sheet"
            className={styles.bookmark}
          >
            Character Sheet
          </TabsTrigger>
          <TabsTrigger
            value="narrative"
            className={styles.bookmark}
          >
            Narrative
          </TabsTrigger>
          <div className={styles.playTools}>
            <ConcentrationBadge />
            <RollLayer />
          </div>
        </TabsList>

        <TabsContent value="sheet" className={styles.tabPage}>
          <SheetPanel />
        </TabsContent>

        <TabsContent value="narrative" className={styles.tabPage}>
          <NarrativePanel
            campaignPageBacklinks={campaignPageBacklinks}
            timelineEvents={timelineEvents}
            relationships={relationships}
          />
        </TabsContent>
      </Tabs>

      {/* Damage-triggered CON-save dialog (T7) — renders nothing until the HP
          tracker raises a check; portal-rendered, so this single mount covers
          both the desktop and mobile HP flows. */}
      <ConcentrationPrompt />
    </div>
  );
}
