"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import { HpPicker } from "@/components/builder/class-step-rail/hp-picker";
import { FeatureCard } from "@/components/builder/class-step-rail/feature-card";
import { ChoiceCardASI } from "@/components/builder/class-step-rail/choice-card-asi";
import { ChoiceCardSubclass } from "@/components/builder/class-step-rail/choice-card-subclass";
import { ChoiceCardFightingStyle } from "@/components/builder/class-step-rail/choice-card-fighting-style";
import { ChoiceCardGeneric } from "@/components/builder/class-step-rail/choice-card-generic";
import { ChoiceCardFavoredEnemy } from "@/components/builder/class-step-rail/choice-card-favored-enemy";
import type { FavoredEnemyChoice } from "@/lib/builder/favored-enemy";
import type { ContentEntry } from "@/components/builder/content-browser";
import type { PerLevel } from "@/lib/builder/class-features-per-level";
import type { CharacterChoices, AsiChoice, HpRollRecord, UsableFeatOption, UsableFeatSearch } from "@/lib/types/character";
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
  feats?: UsableFeatOption[];
  onFeatSearch?: UsableFeatSearch;
  currentSubclass: string | undefined;
  classChoices: ChoiceEffect[];
  hitDie: number;
  hpRule: HpRule;
  conMod: number;
  hpRolls: Record<string, HpRollRecord>;
  onAsiSelect: (featureSlug: string, choice: AsiChoice) => Promise<void> | void;
  onSubclassSelect: (classSlug: string, classIndex: number, subclassSlug: string | undefined) => void;
  onFightingStyleSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => void;
  onChoiceSelect: (choiceId: string, selections: string[]) => void;
  availableLanguages?: readonly string[];
  onFavoredEnemySelect?: (featureSlug: string, value: FavoredEnemyChoice) => Promise<void> | void;
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
  feats = [],
  onFeatSearch,
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
  availableLanguages = [],
  onFavoredEnemySelect,
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
  const isEmpty = row.features.length === 0 && row.choices.length === 0 &&
    !(row.level === 1 && classChoices.length > 0);
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
              classChoices.filter(choice => !row.choices.some(item => item.choiceEffect?.choice_id === choice.choice_id)).map((choice) => (
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
              if (choice.type === "favored-enemy" && choice.featureSlug) {
                return choice.favoredEnemyOptions && onFavoredEnemySelect ? <ChoiceCardFavoredEnemy
                  key={choice.featureSlug} featureSlug={choice.featureSlug} label={choice.label} options={choice.favoredEnemyOptions}
                  value={localChoices.favored_enemies?.[choice.featureSlug]} availableLanguages={availableLanguages}
                  onSelect={value => onFavoredEnemySelect(choice.featureSlug!, value)} />
                  : <p key={choice.featureSlug} role="status">This favored enemy choice could not be loaded. Reload before editing.</p>;
              }
              if (choice.type === "asi") {
                return (
                  <ChoiceCardASI
                    key={choice.featureSlug ?? `${choice.type}-${idx}`}
                    featureSlug={choice.featureSlug!}
                    currentChoice={localChoices.asi_choices?.[choice.featureSlug!]}
                    feats={feats}
                    onSearch={onFeatSearch}
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
                const selectedStyles = localChoices.resolved_choices?.[choice.featureSlug!] ?? [];
                const currentStyle = selectedStyles.length === 1 ? selectedStyles[0] : undefined;
                return (
                  <ChoiceCardFightingStyle
                    key={`${choice.type}-${idx}`}
                    featureSlug={choice.featureSlug!}
                    classSlug={classSlug}
                    styleOptions={choice.fightingStyleOptions ? styleOptions.filter(style => choice.fightingStyleOptions!.includes(style.slug)) : styleOptions}
                    currentStyleSlug={currentStyle}
                    onSelect={onFightingStyleSelect}
                  />
                );
              }
              if (choice.type === "generic" && choice.choiceEffect) {
                const effect = choice.choiceEffect;
                return <ChoiceCardGeneric key={effect.choice_id} choiceEffect={effect}
                  currentSelections={localChoices.resolved_choices?.[effect.choice_id] ?? []}
                  onSelect={selections => onChoiceSelect(effect.choice_id, selections)} />;
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
