"use client";

import { resolveChoiceOptions } from "@/lib/builder/choice-validation";
import { SelectionDropdowns } from "@/components/builder/selection-dropdowns";
import type { ChoiceEffect } from "@/lib/types/effects";

interface ChoiceSelectorProps {
  choiceEffect: ChoiceEffect;
  currentSelections: string[];
  onSelect: (selections: string[]) => void;
  label?: string;
  disabled?: boolean;
}

export function ChoiceSelector({
  choiceEffect,
  currentSelections,
  onSelect,
  label,
  disabled = false,
}: ChoiceSelectorProps) {
  const resolvedOptions = resolveChoiceOptions(choiceEffect);
  const options = resolvedOptions ?? [];
  const maxSelections = choiceEffect.choose;
  const invalidSelections = !!resolvedOptions && (
    !Number.isInteger(maxSelections) || maxSelections < 1 || maxSelections > 100 || currentSelections.length > maxSelections ||
    new Set(currentSelections).size !== currentSelections.length ||
    currentSelections.some(selection => !options.includes(selection))
  );

  const choiceLabel = label ?? `Choose ${maxSelections} ${choiceEffect.grant_type.replace(/_/g, " ")}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {choiceLabel}
        </p>
        <span className="text-xs text-muted-foreground">
          {currentSelections.length} / {maxSelections} selected
        </span>
      </div>
      {!resolvedOptions && <p role="alert" className="text-sm text-destructive">Options for this choice are unavailable. Saved picks are kept. Reload the saved content before choosing again.</p>}
      {(!resolvedOptions || invalidSelections) && currentSelections.length > 0 && <p className="text-sm text-muted-foreground">Saved selections: {currentSelections.map(value => value.replace(/^skill-/, "").replace(/-/g, " ")).join(", ")}.</p>}
      {invalidSelections && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">Saved selections do not match the available choices. Clear them and choose again.</p>
          <button type="button" disabled={disabled} onClick={() => onSelect([])} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Clear saved selections
          </button>
        </div>
      )}
      <SelectionDropdowns label={choiceLabel} options={options} selected={currentSelections} limit={maxSelections}
        disabled={disabled || !resolvedOptions || invalidSelections} onChange={onSelect}
        optionLabel={option => option.replace(/^skill-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())} />
    </div>
  );
}
