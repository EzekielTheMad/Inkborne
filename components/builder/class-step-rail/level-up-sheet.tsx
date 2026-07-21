"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LevelUpPane } from "@/components/builder/class-step-rail/level-up-pane";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord, UsableFeatOption, UsableFeatSearch } from "@/lib/types/character";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface LevelUpSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classContent: ContentEntry;
  classIndex: number;
  isPrimaryClass: boolean;
  draftLevel: number;
  totalLevelAfterConfirm: number;
  perLevelRow: PerLevel;
  subclasses: ContentEntry[];
  styleOptions: ContentEntry[];
  localChoices: CharacterChoices;
  feats?: UsableFeatOption[];
  onFeatSearch?: UsableFeatSearch;
  currentSubclass: string | undefined;
  classChoices: ChoiceEffect[];
  hpRule: HpRule;
  conMod: number;
  hpRolls: Record<string, HpRollRecord>;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
  onHpRollChange: (key: string, record: HpRollRecord) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LevelUpSheet(props: LevelUpSheetProps) {
  const {
    open, onOpenChange,
    classContent, classIndex, isPrimaryClass, draftLevel, totalLevelAfterConfirm,
    perLevelRow, subclasses, styleOptions, localChoices, feats = [], onFeatSearch, currentSubclass, classChoices,
    hpRule, conMod, hpRolls,
    onAsiSelect, onSubclassSelect, onFightingStyleSelect, onChoiceSelect, onHpRollChange,
    onCancel, onConfirm,
  } = props;

  return (
    <Drawer open={open} onOpenChange={(next) => {
      if (!next) onCancel();
      onOpenChange(next);
    }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>{classContent.name} · Level {draftLevel}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Choose the new features and hit points for {classContent.name} at level {draftLevel}.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <LevelUpPane
            classContent={classContent}
            classIndex={classIndex}
            isPrimaryClass={isPrimaryClass}
            draftLevel={draftLevel}
            totalLevelAfterConfirm={totalLevelAfterConfirm}
            perLevelRow={perLevelRow}
            subclasses={subclasses}
            styleOptions={styleOptions}
            localChoices={localChoices}
            feats={feats}
            onFeatSearch={onFeatSearch}
            currentSubclass={currentSubclass}
            classChoices={classChoices}
            hpRule={hpRule}
            conMod={conMod}
            hpRolls={hpRolls}
            onAsiSelect={onAsiSelect}
            onSubclassSelect={onSubclassSelect}
            onFightingStyleSelect={onFightingStyleSelect}
            onChoiceSelect={onChoiceSelect}
            onHpRollChange={onHpRollChange}
            onCancel={onCancel}
            onConfirm={onConfirm}
            chrome="embedded"
            renderFooter={(footer) => <DrawerFooter className="mt-auto">{footer}</DrawerFooter>}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
