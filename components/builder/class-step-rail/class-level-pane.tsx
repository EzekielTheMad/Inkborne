"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";
import { ChoiceCardGeneric } from "@/components/builder/class-step-rail/choice-card-generic";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { CharacterChoices, AsiChoice, HpRollRecord } from "@/lib/types/character";
import type { ChoiceEffect } from "@/lib/types/effects";
import type { HpRule } from "@/lib/builder/level-up-rules";

interface ClassLevelPaneProps {
  classSlug: string;
  className_: string;
  classIndex: number;
  isPrimaryClass: boolean;
  row: PerLevel | undefined;
  subclasses: ContentEntry[];
  styleOptions: ContentEntry[];
  localChoices: CharacterChoices;
  currentSubclass: string | undefined;
  classChoices: ChoiceEffect[];
  hitDie: number;
  hpRule: HpRule;
  conMod: number;
  hpRolls: Record<string, HpRollRecord>;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => void;
  onChoiceSelect: (choiceId: string, selections: string[]) => void;
  onHpRollChange: (key: string, record: HpRollRecord) => void;
}

function paneTitle(row: PerLevel): string {
  if (row.choices.length > 0) return row.choices[0].label;
  if (row.features.length === 1) return row.features[0].name;
  return `Level ${row.level}`;
}

export function ClassLevelPane({
  classSlug,
  className_,
  classIndex,
  isPrimaryClass,
  row,
  subclasses,
  styleOptions,
  localChoices,
  currentSubclass,
  classChoices,
  hitDie,
  hpRule,
  conMod,
  hpRolls,
  onAsiSelect,
  onSubclassSelect,
  onFightingStyleSelect,
  onChoiceSelect,
  onHpRollChange,
}: ClassLevelPaneProps) {
  if (!row) {
    return (
      <p className="text-sm text-muted-foreground">
        No class data for the selected level.
      </p>
    );
  }

  const title = paneTitle(row);
  const isEmpty = row.features.length === 0 && row.choices.length === 0;
  const isFirstLevelOfPrimary = isPrimaryClass && row.level === 1;
  const hpKey = `${classSlug}-${row.level}`;
  const storedRoll = hpRolls[hpKey];

  return (
    <section aria-labelledby="class-level-title" className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClassEmblem slug={classSlug} name={className_} size="sm" />
        <span>{className_}</span>
        <span aria-hidden="true">›</span>
        <span>Level {row.level}</span>
      </nav>

      <h2 id="class-level-title" className="text-2xl font-semibold text-accent">
        {title}
      </h2>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No new features at this level. {className_}&apos;s level {row.level} grants spell-slot or proficiency upgrades only.
        </p>
      ) : (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            What this level grants
          </h3>
          <div className="space-y-2">
            {row.level === 1 &&
              classChoices.map((choice) => (
                <ChoiceCardGeneric
                  key={choice.choice_id}
                  choiceEffect={choice}
                  currentSelections={localChoices.resolved_choices?.[choice.choice_id] ?? []}
                  onSelect={(selections) => onChoiceSelect(choice.choice_id, selections)}
                />
              ))}
            {row.features.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
            {row.choices.map((choice, idx) => {
              if (choice.type === "asi") {
                return (
                  <ChoiceCardASI
                    key={`${choice.type}-${idx}`}
                    featureSlug={choice.featureSlug!}
                    currentChoice={localChoices.asi_choices?.[choice.featureSlug!]}
                    onSelect={(c) => onAsiSelect(choice.featureSlug!, c)}
                  />
                );
              }
              if (choice.type === "subclass") {
                return (
                  <ChoiceCardSubclass
                    key={`${choice.type}-${idx}`}
                    classSlug={classSlug}
                    subclasses={subclasses}
                    currentSelection={currentSubclass}
                    onSelect={(slug) => onSubclassSelect(classSlug, classIndex, slug)}
                    label={choice.label}
                  />
                );
              }
              if (choice.type === "fighting-style") {
                const currentStyle = localChoices.resolved_choices?.[choice.featureSlug!]?.[0];
                return (
                  <ChoiceCardFightingStyle
                    key={`${choice.type}-${idx}`}
                    featureSlug={choice.featureSlug!}
                    classSlug={classSlug}
                    styleOptions={styleOptions}
                    currentStyleSlug={currentStyle}
                    onSelect={onFightingStyleSelect}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      <HpPicker
        classSlug={classSlug}
        level={row.level}
        hitDie={hitDie}
        conMod={conMod}
        isFirstLevelOfPrimary={isFirstLevelOfPrimary}
        hpRule={hpRule}
        storedRoll={storedRoll}
        onChange={(record) => onHpRollChange(hpKey, record)}
      />
    </section>
  );
}
