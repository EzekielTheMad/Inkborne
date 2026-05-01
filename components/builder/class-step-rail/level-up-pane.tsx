"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import { ChevronRight } from "lucide-react";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";
import { ChoiceCardGeneric } from "@/components/builder/class-step-rail/choice-card-generic";
import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";
import { LevelUpActionBar } from "@/components/builder/class-step-rail/level-up-action-bar";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface LevelUpPaneProps {
  classContent: ContentEntry;
  classIndex: number;
  isPrimaryClass: boolean;
  draftLevel: number;
  totalLevelAfterConfirm: number;
  perLevelRow: PerLevel;
  subclasses: ContentEntry[];
  styleOptions: ContentEntry[];
  localChoices: CharacterChoices;
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

function getFeatureDescription(features: ContentEntry[]): string | null {
  for (const f of features) {
    const desc = (f.data as Record<string, unknown>).description;
    if (typeof desc === "string" && desc.length > 0) return desc;
  }
  return null;
}

export function LevelUpPane(props: LevelUpPaneProps) {
  const {
    classContent, classIndex, isPrimaryClass, draftLevel, totalLevelAfterConfirm,
    perLevelRow, subclasses, styleOptions, localChoices, currentSubclass, classChoices,
    hpRule, conMod, hpRolls,
    onAsiSelect, onSubclassSelect, onFightingStyleSelect, onChoiceSelect, onHpRollChange,
    onCancel, onConfirm,
  } = props;

  const hitDie = (classContent.data as Record<string, unknown>).hit_die as number | undefined ?? 8;
  const isFirstLevelOfPrimary = isPrimaryClass && draftLevel === 1;
  const hpKey = `${classContent.slug}-${draftLevel}`;
  const storedRoll = hpRolls[hpKey];

  const headingText = perLevelRow.features[0]?.name ?? `Level ${draftLevel}`;
  const description = getFeatureDescription(perLevelRow.features);

  const allChoicesMade = perLevelRow.choices.every((c) => c.isMade);
  const hpSet = isFirstLevelOfPrimary || storedRoll != null;
  const canConfirm = allChoicesMade && hpSet;

  const missingReasons: string[] = [];
  if (!allChoicesMade) {
    const unmadeLabels = perLevelRow.choices.filter((c) => !c.isMade).map((c) => c.label);
    missingReasons.push(`Pick: ${unmadeLabels.join(", ")}`);
  }
  if (!hpSet) missingReasons.push("Set HP for this level");
  const missingReason = missingReasons.join(" · ");

  return (
    <section aria-labelledby="level-up-heading" className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClassEmblem slug={classContent.slug} name={classContent.name} size="sm" />
        <span>{classContent.name}</span>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span>Level {draftLevel}</span>
        <span
          role="status"
          aria-label="Pending new level"
          className="ml-2 rounded-sm border border-[rgba(201,164,74,0.4)] bg-[rgba(201,164,74,0.15)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c9a44a] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          NEW LEVEL
        </span>
      </div>

      <h2 id="level-up-heading" className="text-2xl font-semibold leading-tight">
        {headingText}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {perLevelRow.features.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What this level grants
          </p>
          <div className="mt-2 space-y-2">
            {perLevelRow.features.map((f) => (
              <FeatureCard key={f.slug} feature={f} />
            ))}
          </div>
        </div>
      )}

      {perLevelRow.choices.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Choices for this level
          </p>
          <div className="mt-2 space-y-2">
            {perLevelRow.choices.map((choice) => {
              if (choice.type === "subclass") {
                return (
                  <ChoiceCardSubclass
                    key={`${choice.classSlug}-subclass`}
                    classSlug={choice.classSlug}
                    subclasses={subclasses}
                    currentSelection={currentSubclass}
                    onSelect={(slug) => onSubclassSelect(choice.classSlug, classIndex, slug)}
                    label={choice.label}
                  />
                );
              }
              if (choice.type === "asi" && choice.featureSlug) {
                return (
                  <ChoiceCardASI
                    key={choice.featureSlug}
                    featureSlug={choice.featureSlug}
                    currentChoice={localChoices.asi_choices?.[choice.featureSlug]}
                    onSelect={(c) => onAsiSelect(choice.featureSlug!, c)}
                  />
                );
              }
              if (choice.type === "fighting-style" && choice.featureSlug) {
                return (
                  <ChoiceCardFightingStyle
                    key={choice.featureSlug}
                    featureSlug={choice.featureSlug}
                    classSlug={choice.classSlug}
                    styleOptions={styleOptions}
                    currentStyleSlug={localChoices.resolved_choices?.[choice.featureSlug]?.[0]}
                    onSelect={(featureSlug, classSlug, styleSlug) =>
                      onFightingStyleSelect(featureSlug, classSlug, styleSlug)
                    }
                  />
                );
              }
              if (choice.type === "generic") {
                // Generic choices are looked up in `classChoices` (the class's ChoiceEffect[])
                // by treating `choice.featureSlug` as a `choice_id`. classFeaturesPerLevel
                // doesn't yet emit "generic" entries — when it does, ensure the per-level
                // helper passes the ChoiceEffect's `choice_id` value as featureSlug.
                const choiceEffect = classChoices.find((e) => e.choice_id === choice.featureSlug);
                if (!choiceEffect) return null;
                return (
                  <ChoiceCardGeneric
                    key={choice.featureSlug}
                    choiceEffect={choiceEffect}
                    currentSelections={localChoices.resolved_choices?.[choiceEffect.choice_id] ?? []}
                    onSelect={(selections) => onChoiceSelect(choiceEffect.choice_id, selections)}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      <HpPicker
        classSlug={classContent.slug}
        level={draftLevel}
        hitDie={hitDie}
        conMod={conMod}
        isFirstLevelOfPrimary={isFirstLevelOfPrimary}
        hpRule={hpRule}
        storedRoll={storedRoll}
        onChange={(record) => onHpRollChange(hpKey, record)}
      />

      <LevelUpActionBar
        classLabel={classContent.name}
        draftLevel={draftLevel}
        totalLevelAfterConfirm={totalLevelAfterConfirm}
        canConfirm={canConfirm}
        missingReason={missingReason}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </section>
  );
}
