"use client";

import { resolveChoiceOptions } from "@/lib/builder/choice-validation";
import { cn } from "@/lib/utils";
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
  const invalidSelections = Array.isArray(choiceEffect.from) && (
    currentSelections.length > maxSelections ||
    new Set(currentSelections).size !== currentSelections.length ||
    currentSelections.some(selection => !options.includes(selection))
  );

  function handleToggle(option: string) {
    if (disabled) return;
    if (currentSelections.includes(option)) {
      // Deselect
      onSelect(currentSelections.filter((s) => s !== option));
    } else if (currentSelections.length < maxSelections) {
      // Select
      onSelect([...currentSelections, option]);
    }
    // If at max, do nothing (already at limit)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {label ?? `Choose ${maxSelections} ${choiceEffect.grant_type.replace(/_/g, " ")}`}
        </p>
        <span className="text-xs text-muted-foreground">
          {currentSelections.length} / {maxSelections} selected
        </span>
      </div>
      {!resolvedOptions && <p role="alert" className="text-sm text-destructive">Options for this choice are unavailable. Saved picks are kept. Reload the saved content before choosing again.</p>}
      {invalidSelections && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">Saved selections do not match the available choices. Clear them and choose again.</p>
          <button type="button" disabled={disabled} onClick={() => onSelect([])} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Clear saved selections
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = currentSelections.includes(option);
          const isDisabled =
            !isSelected && currentSelections.length >= maxSelections;

          return (
            <button
              key={option}
              type="button"
              onClick={() => handleToggle(option)}
              aria-pressed={isSelected}
              disabled={disabled || isDisabled}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                isSelected
                  ? "bg-character-bg text-character-fg border-character-border"
                  : isDisabled
                    ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                    : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground cursor-pointer",
              )}
            >
              {option
                .replace(/^skill-/, "")
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          );
        })}
      </div>
    </div>
  );
}
