"use client";

import { useState } from "react";
import { LevelRail } from "@/components/builder/class-step-rail/level-rail";
import { LevelRailMobile } from "@/components/builder/class-step-rail/level-rail-mobile";
import { CharacterStrip } from "@/components/builder/class-step-rail/character-strip";
import { ClassLevelPane } from "@/components/builder/class-step-rail/class-level-pane";
import { ClassLevelSheet } from "@/components/builder/class-step-rail/class-level-sheet";
import { LevelUpPane } from "@/components/builder/class-step-rail/level-up-pane";
import { AddClassRow } from "@/components/builder/class-step-rail/add-class-row";
import { ClassPickerPanel } from "@/components/builder/class-step-rail/class-picker-panel";
import { ClassPickerSheet } from "@/components/builder/class-step-rail/class-picker-sheet";
import { LevelUpSheet } from "@/components/builder/class-step-rail/level-up-sheet";
import { Separator } from "@/components/ui/separator";
import { classFeaturesPerLevel, buildRenderedPerLevel, pendingChoicesUpTo } from "@/lib/builder/class-features-per-level";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
import { useIsMobile } from "@/lib/builder/use-is-mobile";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

export interface ClassStepRailProps {
  characterName?: string;
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
    characterName = "Character",
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

  // Drives layout branch selection (mobile vs. desktop).
  // SSR-safe: always false on server + first client render; updates post-hydration via useEffect.
  const isMobile = useIsMobile();

  const initialClassIndex = 0;
  const initialLevel = selectedClasses[0]?.level ?? 1;
  const [selectedState, setSelected] = useState<SelectedKey>({
    classIndex: initialClassIndex,
    level: initialLevel,
  });
  const [pickerOpenedAtClassCount, setPickerOpenedAtClassCount] = useState<number | null>(null);
  const [pendingLevelUpDraft, setLevelUpDraft] = useState<LevelUpDraft | null>(null);
  // Mobile-only: which class/level the level-detail bottom sheet shows (null = closed).
  // Mobile has no static main pane, so this sheet is how per-level choices are reached
  // outside the level-up flow (UAT A3).
  const [mobileDetail, setMobileDetail] = useState<SelectedKey | null>(null);
  // Local HP rolls accumulated during the current draft flow, merged over the persisted hpRolls prop.
  const [draftHpRolls, setDraftHpRolls] = useState<Record<string, HpRollRecord>>({});

  // Treat parent-owned class/level changes as acknowledgements instead of
  // mirroring them into local state from an effect. This keeps the successful
  // add/level-up transition synchronous without a cascading render.
  const pickerClosedByAddition =
    pickerOpenedAtClassCount !== null && selectedClasses.length > pickerOpenedAtClassCount;
  const completedLevelUp =
    pendingLevelUpDraft !== null &&
    (selectedClasses[pendingLevelUpDraft.classIndex]?.level ?? 0) >= pendingLevelUpDraft.draftLevel;
  const showPicker = pickerOpenedAtClassCount !== null && !pickerClosedByAddition;
  const levelUpDraft = completedLevelUp ? null : pendingLevelUpDraft;
  const selected: SelectedKey = pickerClosedByAddition
    ? { classIndex: selectedClasses.length - 1, level: 1 }
    : completedLevelUp && pendingLevelUpDraft
      ? {
          classIndex: pendingLevelUpDraft.classIndex,
          level: selectedClasses[pendingLevelUpDraft.classIndex]?.level ?? pendingLevelUpDraft.draftLevel,
        }
      : selectedState;
  const setShowPicker = (open: boolean) => {
    setPickerOpenedAtClassCount(open ? selectedClasses.length : null);
  };
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

  // ---------------------------------------------------------------------------
  // Shared: per-class computed values builder.
  // ---------------------------------------------------------------------------
  function buildRailProps(cls: typeof selectedClasses[number], idx: number) {
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

    const draftClassIndex = levelUpDraft?.classIndex ?? -1;
    const draftLevelValue = levelUpDraft?.draftLevel ?? -1;
    const isActiveFlowRail = isMidFlow && draftClassIndex === idx;

    // Append the pending draft row only while the draft level is genuinely
    // ahead of the persisted level. During the confirm transition the level
    // bumps before the draft clears; appending here would duplicate a level row
    // (and its React key). See buildRenderedPerLevel.
    const renderedPerLevel = buildRenderedPerLevel(
      perLevel,
      cls.level,
      isActiveFlowRail ? draftLevelValue : null,
    );

    const railDisabled = isMidFlow;

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

    const activeLevel = isActiveFlowRail
      ? draftLevelValue
      : selected.classIndex === idx && !showPicker
        ? selected.level
        : -1;

    const handleSelectLevel = (level: number) => {
      if (railDisabled) return;
      if (isActiveFlowRail && level !== draftLevelValue) return;
      setShowPicker(false);
      if (completedLevelUp) setLevelUpDraft(null);
      setSelected({ classIndex: idx, level });
    };

    /**
     * First level ≤ `level` that still has a required-but-unmade choice.
     * Computed against the FULL per-level rows (not the rendered clip) so a
     * direct set-level jump can look ahead into the newly unlocked range.
     */
    const firstPendingLevelUpTo = (level: number): number | null =>
      pendingChoicesUpTo(perLevel, level)[0]?.level ?? null;

    const handleLevelChange = (newLevel: number) => {
      // UAT A4: a direct set-level jump bypasses the step-by-step flow, so any
      // required choice in the new range (subclass, ASI, …) would be silently
      // skipped. Land the selection on the first pending choice instead.
      const pendingLevel = firstPendingLevelUpTo(newLevel);
      if (pendingLevel != null) {
        setSelected({ classIndex: idx, level: pendingLevel });
      } else if (selected.classIndex === idx && selected.level > newLevel) {
        setSelected({ classIndex: idx, level: newLevel });
      }
      if (completedLevelUp) setLevelUpDraft(null);
      onLevelChange(idx, newLevel);
    };

    const handleLevelUpClick = () => {
      if (buttonState !== "idle") return;
      setShowPicker(false);
      setMobileDetail(null);
      setDraftHpRolls({});
      setLevelUpDraft({ classIndex: idx, draftLevel: cls.level + 1 });
    };

    return {
      classContent,
      subclassContent,
      renderedPerLevel,
      railDisabled,
      buttonState,
      buttonReason,
      activeLevel,
      handleSelectLevel,
      handleLevelChange,
      handleLevelUpClick,
      firstPendingLevelUpTo,
    };
  }

  // ---------------------------------------------------------------------------
  // AddClassRow: same logic for both layout branches.
  // ---------------------------------------------------------------------------
  const addClassRowJsx = isMidFlow ? (
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
  );

  // ---------------------------------------------------------------------------
  // MOBILE LAYOUT
  // ---------------------------------------------------------------------------
  if (isMobile) {
    // Mobile level-up sheet data (computed when mid-flow).
    let mobileLevelUpSheet: React.ReactNode = null;
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
        const mergedHpRolls = { ...hpRolls, ...draftHpRolls };

        mobileLevelUpSheet = (
          <LevelUpSheet
            open={isMidFlow}
            onOpenChange={(next) => {
              if (!next) {
                setLevelUpDraft(null);
                setDraftHpRolls({});
                onCancelLevelUp();
              }
            }}
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
    }

    // Mobile level detail sheet (UAT A3): the sub-`md` equivalent of the desktop
    // main pane. Reuses <ClassLevelPane> — including the same choice cards
    // (subclass / ASI / fighting style) the level-up flow renders.
    let mobileDetailSheet: React.ReactNode = null;
    if (mobileDetail) {
      const cls = selectedClasses[mobileDetail.classIndex];
      const classContent = classes.find((c) => c.slug === cls?.slug);
      if (classContent && cls) {
        const subclassContent = cls.subclass
          ? subclasses.find((sc) => sc.slug === cls.subclass) ?? null
          : null;
        const perLevel = classFeaturesPerLevel({
          classContent,
          features,
          subclassContent,
          characterChoices: localChoices,
          classIndex: mobileDetail.classIndex,
        });
        const row = perLevel.find((r) => r.level === mobileDetail.level);
        const styleOptions = features.filter((f) => {
          const data = f.data as Record<string, unknown>;
          return data.class === cls.slug && data.feature_type === "fighting_style" && f.name !== "Fighting Style";
        });
        const classChoices = (classContent.effects ?? []).filter(
          (e): e is ChoiceEffect => e.type === "choice",
        );
        const rawHitDie = (classContent.data as Record<string, unknown>).hit_die;
        const hitDie = typeof rawHitDie === "number" && rawHitDie > 0 ? rawHitDie : 8;

        mobileDetailSheet = (
          <ClassLevelSheet
            open
            onOpenChange={(next) => {
              if (!next) setMobileDetail(null);
            }}
            level={mobileDetail.level}
            classSlug={cls.slug}
            className_={classContent.name}
            classIndex={mobileDetail.classIndex}
            isPrimaryClass={mobileDetail.classIndex === 0}
            row={row}
            subclasses={subclasses}
            styleOptions={styleOptions}
            localChoices={localChoices}
            currentSubclass={cls.subclass}
            classChoices={classChoices}
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
      }
    }

    return (
      <>
        <div className="flex flex-col md:hidden">
          {selectedClasses.length > 1 && (
            <CharacterStrip
              characterName={characterName}
              totalLevel={totalLevel}
              maxLevel={MAX_TOTAL_LEVEL}
              classes={classes}
              selectedClasses={selectedClasses}
            />
          )}
          {selectedClasses.map((cls, idx) => {
            const built = buildRailProps(cls, idx);
            if (!built) return null;
            const {
              classContent,
              subclassContent,
              renderedPerLevel,
              railDisabled,
              buttonState,
              buttonReason,
              activeLevel,
              handleSelectLevel,
              handleLevelChange,
              handleLevelUpClick,
              firstPendingLevelUpTo,
            } = built;
            return (
              <LevelRailMobile
                key={`${cls.slug}-${idx}-mobile`}
                classSlug={cls.slug}
                className_={classContent.name}
                subclassName={subclassContent?.name}
                currentLevel={cls.level}
                perLevel={renderedPerLevel}
                activeLevel={activeLevel}
                onSelectLevel={(level) => {
                  // Mobile has no static main pane — the level detail sheet is it.
                  handleSelectLevel(level);
                  if (!railDisabled) setMobileDetail({ classIndex: idx, level });
                }}
                onLevelChange={(newLevel) => {
                  // UAT A4: after a direct set-level jump, immediately open the
                  // detail sheet on the first skipped required choice (if any).
                  const pendingLevel = firstPendingLevelUpTo(newLevel);
                  handleLevelChange(newLevel);
                  if (pendingLevel != null) {
                    setMobileDetail({ classIndex: idx, level: pendingLevel });
                  }
                }}
                onRemoveClass={() => onRemoveClass(idx)}
                disabled={railDisabled}
                onLevelUpClick={handleLevelUpClick}
                levelUpButtonState={buttonState}
                levelUpButtonReason={buttonReason}
              />
            );
          })}
          <Separator />
          {addClassRowJsx}
        </div>

        {showPicker && (
          <ClassPickerSheet
            open={showPicker}
            onOpenChange={(next) => {
              if (!next) setShowPicker(false);
            }}
            classes={classes}
            resolvedStats={resolvedStats}
            selectedClasses={selectedClasses}
            levelsRemaining={levelsRemaining}
            onSelect={onAddClass}
            onCancel={() => setShowPicker(false)}
          />
        )}

        {mobileLevelUpSheet}

        {mobileDetailSheet}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // DESKTOP LAYOUT (default: SSR, no matchMedia, or desktop viewport)
  // ---------------------------------------------------------------------------
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
          const built = buildRailProps(cls, idx);
          if (!built) return null;
          const {
            classContent,
            subclassContent,
            renderedPerLevel,
            railDisabled,
            buttonState,
            buttonReason,
            activeLevel,
            handleSelectLevel,
            handleLevelChange,
            handleLevelUpClick,
          } = built;
          return (
            <LevelRail
              key={`${cls.slug}-${idx}`}
              classSlug={cls.slug}
              className_={classContent.name}
              subclassName={subclassContent?.name}
              currentLevel={cls.level}
              perLevel={renderedPerLevel}
              activeLevel={activeLevel}
              onSelectLevel={handleSelectLevel}
              onLevelChange={handleLevelChange}
              onRemoveClass={() => onRemoveClass(idx)}
              disabled={railDisabled}
              onLevelUpClick={handleLevelUpClick}
              levelUpButtonState={buttonState}
              levelUpButtonReason={buttonReason}
            />
          );
        })}
        <Separator />
        {addClassRowJsx}
      </aside>

      <div className="min-w-0">{mainPaneContent}</div>
    </div>
  );
}
