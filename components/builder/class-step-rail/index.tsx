"use client";

import { useEffect, useRef, useState } from "react";
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";
import { Separator } from "@/components/ui/separator";
import { classFeaturesPerLevel } from "@/lib/builder/class-features-per-level";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice } from "@/lib/types/character";

export interface ClassStepRailProps {
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
  selectedClasses: Array<{
    slug: string;
    level: number;
    subclass?: string;
  }>;
  localChoices: CharacterChoices;
  contentRefs: Array<{
    id: string;
    content_definitions?: { slug: string; content_type: string };
  }>;
  /** Engine-resolved ability scores for the current build. */
  resolvedStats: Record<string, number>;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void> | void;
  onRemoveClass: (classIndex: number) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
  /** Called when a met card in the picker is clicked. Parent opens the existing ClassPreviewModal. */
  onAddClass: (content: ContentEntry) => void;
}

interface SelectedKey {
  classIndex: number;
  level: number;
}

const MULTICLASS_PREREQS_LOCKED_REASONS = [
  "Requires CHA 13 for Bard / Sorcerer / Warlock",
  "Requires INT 13 for Wizard",
  "Requires WIS 13 for Cleric / Druid / Ranger",
  "Requires STR 13 for Barbarian / Paladin",
  "Requires DEX 13 for Rogue",
];

const MAX_TOTAL_LEVEL = 20;

export function ClassStepRail(props: ClassStepRailProps) {
  const {
    classes,
    subclasses,
    features,
    selectedClasses,
    localChoices,
    resolvedStats,
    onLevelChange,
    onRemoveClass,
    onSubclassSelect,
    onAsiSelect,
    onFightingStyleSelect,
    onChoiceSelect,
    onAddClass,
  } = props;

  const initialClassIndex = 0;
  const initialLevel = selectedClasses[0]?.level ?? 1;
  const [selected, setSelected] = useState<SelectedKey>({
    classIndex: initialClassIndex,
    level: initialLevel,
  });
  const [showPicker, setShowPicker] = useState(false);

  // Close picker after a successful add (selectedClasses.length increments
  // via parent's handleSelectClass) and focus the new class's pane.
  const prevLengthRef = useRef(selectedClasses.length);
  useEffect(() => {
    if (selectedClasses.length > prevLengthRef.current) {
      setShowPicker(false);
      setSelected({ classIndex: selectedClasses.length - 1, level: 1 });
    }
    prevLengthRef.current = selectedClasses.length;
  }, [selectedClasses.length]);

  const totalLevel = selectedClasses.reduce((sum, c) => sum + c.level, 0);
  const levelsRemaining = MAX_TOTAL_LEVEL - totalLevel;

  const prereqs = multiclassPrereqsForAll(resolvedStats, selectedClasses, classes);
  const anyMet = prereqs.some((p) => p.state === "met");
  const canAddClass = anyMet && levelsRemaining > 0;

  const activeClass = selectedClasses[selected.classIndex];
  const activeClassContent = activeClass ? classes.find((c) => c.slug === activeClass.slug) : undefined;
  const activeSubclassContent = activeClass?.subclass
    ? subclasses.find((sc) => sc.slug === activeClass.subclass) ?? null
    : null;

  const activePerLevel = activeClassContent
    ? classFeaturesPerLevel({
        classContent: activeClassContent,
        features,
        subclassContent: activeSubclassContent,
        characterChoices: localChoices,
        classIndex: selected.classIndex,
      })
    : [];

  const activeRow = activePerLevel.find((r) => r.level === selected.level);

  const activeClassChoices = activeClassContent
    ? (activeClassContent.effects ?? []).filter(
        (e): e is import("@/lib/types/effects").ChoiceEffect => e.type === "choice",
      )
    : [];

  const styleOptionsForActiveClass = activeClass
    ? features.filter((f) => {
        const data = f.data as Record<string, unknown>;
        return (
          data.class === activeClass.slug &&
          data.feature_type === "fighting_style" &&
          f.name !== "Fighting Style"
        );
      })
    : [];

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside aria-label="Class levels" className="space-y-4">
        {selectedClasses.map((cls, idx) => {
          const classContent = classes.find((c) => c.slug === cls.slug);
          if (!classContent) return null;
          const subclassContent = cls.subclass ? subclasses.find((sc) => sc.slug === cls.subclass) ?? null : null;
          const perLevel = classFeaturesPerLevel({
            classContent,
            features,
            subclassContent,
            characterChoices: localChoices,
            classIndex: idx,
          });
          return (
            <LevelRail
              key={`${cls.slug}-${idx}`}
              classSlug={cls.slug}
              className_={classContent.name}
              subclassName={subclassContent?.name}
              currentLevel={cls.level}
              perLevel={perLevel.filter((r) => r.level <= cls.level)}
              activeLevel={selected.classIndex === idx && !showPicker ? selected.level : -1}
              onSelectLevel={(level) => {
                setShowPicker(false);
                setSelected({ classIndex: idx, level });
              }}
              onLevelChange={(newLevel) => {
                if (selected.classIndex === idx && selected.level > newLevel) {
                  setSelected({ classIndex: idx, level: newLevel });
                }
                onLevelChange(idx, newLevel);
              }}
              onRemoveClass={() => onRemoveClass(idx)}
            />
          );
        })}
        <Separator />
        {canAddClass ? (
          <AddClassRow
            unlocked
            levelsRemaining={levelsRemaining}
            onClick={() => setShowPicker(true)}
          />
        ) : (
          <AddClassRow reasons={MULTICLASS_PREREQS_LOCKED_REASONS} />
        )}
      </aside>

      <div className="min-w-0">
        {showPicker ? (
          <ClassPickerPanel
            classes={classes}
            resolvedStats={resolvedStats}
            selectedClasses={selectedClasses}
            levelsRemaining={levelsRemaining}
            onSelect={onAddClass}
            onCancel={() => setShowPicker(false)}
          />
        ) : activeRow && activeClass && activeClassContent ? (
          <ClassLevelPane
            classSlug={activeClass.slug}
            className_={activeClassContent.name}
            classIndex={selected.classIndex}
            row={activeRow}
            subclasses={subclasses}
            styleOptions={styleOptionsForActiveClass}
            localChoices={localChoices}
            currentSubclass={activeClass.subclass}
            classChoices={activeClassChoices}
            onAsiSelect={onAsiSelect}
            onSubclassSelect={onSubclassSelect}
            onFightingStyleSelect={onFightingStyleSelect}
            onChoiceSelect={onChoiceSelect}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No class data for the selected level.</p>
        )}
      </div>
    </div>
  );
}
