"use client";

import { useEffect, useRef, useState } from "react";
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import { LevelUpPane } from "@/components/builder/class-step-rail/level-up-pane";
import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";
import { Separator } from "@/components/ui/separator";
import { classFeaturesPerLevel } from "@/lib/builder/class-features-per-level";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

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
  /** Engine-resolved ability scores for the current build. */
  resolvedStats: Record<string, number>;
  /** HP rule for the campaign/session. */
  hpRule: HpRule;
  /** Stored HP roll records keyed by "{classSlug}-{level}". */
  hpRolls: Record<string, HpRollRecord>;
  onLevelChange: (classIndex: number, newLevel: number) => Promise<void> | void;
  onRemoveClass: (classIndex: number) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => Promise<void> | void;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => Promise<void> | void;
  onChoiceSelect: (choiceId: string, selections: string[]) => Promise<void> | void;
  /** Called when a met card in the picker is clicked. Parent opens the existing ClassPreviewModal. */
  onAddClass: (content: ContentEntry) => void;
  onConfirmLevelUp: (payload: { classIndex: number; draftLevel: number }) => void;
  onCancelLevelUp: () => void;
  /** Called when the user picks an HP method for a level. */
  onHpRollChange: (key: string, record: HpRollRecord) => void;
}

interface SelectedKey {
  classIndex: number;
  level: number;
}

interface LevelUpDraft {
  classIndex: number;
  draftLevel: number;
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
    hpRule,
    hpRolls,
    onLevelChange,
    onRemoveClass,
    onSubclassSelect,
    onAsiSelect,
    onFightingStyleSelect,
    onChoiceSelect,
    onAddClass,
    onConfirmLevelUp,
    onCancelLevelUp,
    onHpRollChange,
  } = props;

  const initialClassIndex = 0;
  const initialLevel = selectedClasses[0]?.level ?? 1;
  const [selected, setSelected] = useState<SelectedKey>({
    classIndex: initialClassIndex,
    level: initialLevel,
  });
  const [showPicker, setShowPicker] = useState(false);
  const [levelUpDraft, setLevelUpDraft] = useState<LevelUpDraft | null>(null);
  // Local HP rolls accumulated during the current draft flow, merged over the persisted hpRolls prop
  // so that LevelUpPane can gate Confirm on the current session's picks even before the parent persists.
  const [draftHpRolls, setDraftHpRolls] = useState<Record<string, HpRollRecord>>({});

  // PR-C: close picker after a successful add (selectedClasses.length increments
  // via parent's handleSelectClass) and focus the new class's pane.
  const prevLengthRef = useRef(selectedClasses.length);
  useEffect(() => {
    if (selectedClasses.length > prevLengthRef.current) {
      setShowPicker(false);
      setSelected({ classIndex: selectedClasses.length - 1, level: 1 });
    }
    prevLengthRef.current = selectedClasses.length;
  }, [selectedClasses.length]);

  // Level-up flow: clear draft when the parent confirms (selectedClasses[i].level bumps).
  const prevLevelsRef = useRef(selectedClasses.map((c) => c.level));
  useEffect(() => {
    if (levelUpDraft) {
      const prevLevel = prevLevelsRef.current[levelUpDraft.classIndex];
      const currLevel = selectedClasses[levelUpDraft.classIndex]?.level;
      if (currLevel !== undefined && prevLevel !== undefined && currLevel > prevLevel) {
        // Level bumped — confirm landed.
        setLevelUpDraft(null);
        setDraftHpRolls({});
        setSelected({ classIndex: levelUpDraft.classIndex, level: currLevel });
      }
    }
    prevLevelsRef.current = selectedClasses.map((c) => c.level);
  }, [selectedClasses, levelUpDraft]);

  const totalLevel = selectedClasses.reduce((sum, c) => sum + c.level, 0);
  const levelsRemaining = MAX_TOTAL_LEVEL - totalLevel;

  const prereqs = multiclassPrereqsForAll(resolvedStats, selectedClasses, classes);
  const anyMet = prereqs.some((p) => p.state === "met");
  const canAddClass = anyMet && levelsRemaining > 0;

  const isMidFlow = levelUpDraft !== null;
  const activeFlowClassLabel = isMidFlow
    ? classes.find((c) => c.slug === selectedClasses[levelUpDraft!.classIndex]?.slug)?.name ?? "class"
    : null;

  const conMod = Math.floor(((resolvedStats.constitution ?? 10) - 10) / 2);

  // Active-pane decision tree.
  let mainPaneContent: React.ReactNode;

  if (isMidFlow) {
    const draft = levelUpDraft!;
    const cls = selectedClasses[draft.classIndex];
    const classContent = classes.find((c) => c.slug === cls?.slug);
    const subclassContent = cls?.subclass ? subclasses.find((sc) => sc.slug === cls.subclass) ?? null : null;

    if (classContent && cls) {
      const perLevel = classFeaturesPerLevel({
        classContent,
        features,
        subclassContent,
        characterChoices: localChoices,
        classIndex: draft.classIndex,
      });
      const draftRow = perLevel.find((r) => r.level === draft.draftLevel) ?? {
        level: draft.draftLevel,
        features: [],
        choices: [],
      };
      const styleOptions = features.filter((f) => {
        const data = f.data as Record<string, unknown>;
        return data.class === cls.slug && data.feature_type === "fighting_style" && f.name !== "Fighting Style";
      });
      const classChoices = (classContent.effects ?? []).filter(
        (e): e is ChoiceEffect => e.type === "choice",
      );
      const totalAfter = totalLevel - cls.level + draft.draftLevel;

      // Merge persisted hpRolls with local draft rolls so LevelUpPane's confirm gate
      // responds immediately when the user picks HP (before the parent persists the change).
      const mergedHpRolls = { ...hpRolls, ...draftHpRolls };

      mainPaneContent = (
        <LevelUpPane
          classContent={classContent}
          classIndex={draft.classIndex}
          isPrimaryClass={draft.classIndex === 0}
          draftLevel={draft.draftLevel}
          totalLevelAfterConfirm={totalAfter}
          perLevelRow={draftRow}
          subclasses={subclasses}
          styleOptions={styleOptions}
          localChoices={localChoices}
          currentSubclass={cls.subclass}
          classChoices={classChoices}
          hpRule={hpRule}
          conMod={conMod}
          hpRolls={mergedHpRolls}
          onAsiSelect={onAsiSelect}
          onSubclassSelect={onSubclassSelect}
          onFightingStyleSelect={onFightingStyleSelect}
          onChoiceSelect={onChoiceSelect}
          onHpRollChange={(key, record) => {
            setDraftHpRolls((prev) => ({ ...prev, [key]: record }));
            onHpRollChange(key, record);
          }}
          onCancel={() => {
            setLevelUpDraft(null);
            setDraftHpRolls({});
            onCancelLevelUp();
          }}
          onConfirm={() => {
            onConfirmLevelUp(draft);
            setDraftHpRolls({});
          }}
        />
      );
    }
  } else if (showPicker) {
    mainPaneContent = (
      <ClassPickerPanel
        classes={classes}
        resolvedStats={resolvedStats}
        selectedClasses={selectedClasses}
        levelsRemaining={levelsRemaining}
        onSelect={onAddClass}
        onCancel={() => setShowPicker(false)}
      />
    );
  } else {
    const activeClass = selectedClasses[selected.classIndex];
    const activeClassContent = activeClass ? classes.find((c) => c.slug === activeClass.slug) : undefined;
    const activeSubclassContent = activeClass?.subclass
      ? subclasses.find((sc) => sc.slug === activeClass.subclass) ?? null
      : null;

    if (activeClassContent && activeClass) {
      const activePerLevel = classFeaturesPerLevel({
        classContent: activeClassContent,
        features,
        subclassContent: activeSubclassContent,
        characterChoices: localChoices,
        classIndex: selected.classIndex,
      });
      const activeRow = activePerLevel.find((r) => r.level === selected.level);
      const styleOptionsForActive = features.filter((f) => {
        const data = f.data as Record<string, unknown>;
        return (
          data.class === activeClass.slug &&
          data.feature_type === "fighting_style" &&
          f.name !== "Fighting Style"
        );
      });
      const activeClassChoices = (activeClassContent.effects ?? []).filter(
        (e): e is ChoiceEffect => e.type === "choice",
      );
      const rawHitDie = (activeClassContent.data as Record<string, unknown>).hit_die;
      const hitDie = typeof rawHitDie === "number" && rawHitDie > 0 ? rawHitDie : 8;

      mainPaneContent = (
        <ClassLevelPane
          classSlug={activeClass.slug}
          className_={activeClassContent.name}
          classIndex={selected.classIndex}
          isPrimaryClass={selected.classIndex === 0}
          row={activeRow}
          subclasses={subclasses}
          styleOptions={styleOptionsForActive}
          localChoices={localChoices}
          currentSubclass={activeClass.subclass}
          classChoices={activeClassChoices}
          hitDie={hitDie}
          hpRule={hpRule}
          conMod={conMod}
          hpRolls={hpRolls}
          onAsiSelect={onAsiSelect}
          onSubclassSelect={onSubclassSelect}
          onFightingStyleSelect={onFightingStyleSelect}
          onChoiceSelect={onChoiceSelect}
          onHpRollChange={onHpRollChange}
        />
      );
    } else {
      mainPaneContent = <p className="text-sm text-muted-foreground">No class data for the selected level.</p>;
    }
  }

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

          // Snapshot draft values to stable locals for use in computed values and callbacks.
          const draftClassIndex = levelUpDraft?.classIndex ?? -1;
          const draftLevelValue = levelUpDraft?.draftLevel ?? -1;
          const isActiveFlowRail = isMidFlow && draftClassIndex === idx;

          // Levels rendered: confirmed levels (1..cls.level) plus, if this is the active flow class,
          // an extra draft pill.
          const renderedPerLevel = isActiveFlowRail
            ? [
                ...perLevel.filter((r) => r.level <= cls.level),
                { level: draftLevelValue, features: [], choices: [] },
              ]
            : perLevel.filter((r) => r.level <= cls.level);

          // Hard-lock: all rails are disabled while the flow is active.
          // The active-flow class rail is visually locked too (no dropdown / remove changes mid-flow).
          const railDisabled = isMidFlow;

          // LevelUpButton state per rail.
          let buttonState: "idle" | "disabled" | "active-flow";
          let buttonReason: string | undefined;
          if (isActiveFlowRail) {
            buttonState = "active-flow";
          } else if (isMidFlow) {
            buttonState = "disabled";
            buttonReason = `Finish ${activeFlowClassLabel} ${selectedClasses[draftClassIndex].level + 1} first`;
          } else if (cls.level >= 20) {
            buttonState = "disabled";
            buttonReason = "Lv 20 (max)";
          } else if (totalLevel >= MAX_TOTAL_LEVEL) {
            buttonState = "disabled";
            buttonReason = "Character at Lv 20 (max)";
          } else {
            buttonState = "idle";
          }

          return (
            <LevelRail
              key={`${cls.slug}-${idx}`}
              classSlug={cls.slug}
              className_={classContent.name}
              subclassName={subclassContent?.name}
              currentLevel={cls.level}
              perLevel={renderedPerLevel}
              activeLevel={
                isActiveFlowRail
                  ? draftLevelValue
                  : selected.classIndex === idx && !showPicker
                    ? selected.level
                    : -1
              }
              onSelectLevel={(level) => {
                if (railDisabled) return;
                if (isActiveFlowRail && level !== draftLevelValue) {
                  // Active-class non-draft pill click during flow: no-op (keep flow on draft).
                  return;
                }
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
              disabled={railDisabled}
              onLevelUpClick={() => {
                if (buttonState !== "idle") return;
                setShowPicker(false);
                setLevelUpDraft({ classIndex: idx, draftLevel: cls.level + 1 });
              }}
              levelUpButtonState={buttonState}
              levelUpButtonReason={buttonReason}
            />
          );
        })}
        <Separator />
        {isMidFlow ? (
          <AddClassRow
            reasons={MULTICLASS_PREREQS_LOCKED_REASONS}
            disabledReason="Finish active level-up first"
          />
        ) : canAddClass ? (
          <AddClassRow
            unlocked
            levelsRemaining={levelsRemaining}
            onClick={() => setShowPicker(true)}
          />
        ) : (
          <AddClassRow reasons={MULTICLASS_PREREQS_LOCKED_REASONS} />
        )}
      </aside>

      <div className="min-w-0">{mainPaneContent}</div>
    </div>
  );
}
