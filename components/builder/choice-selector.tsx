"use client";

import { cn } from "@/lib/utils";
import type { ChoiceEffect } from "@/lib/types/effects";

interface ChoiceSelectorProps {
  choiceEffect: ChoiceEffect;
  currentSelections: string[];
  onSelect: (selections: string[]) => void;
  label?: string;
}

export function ChoiceSelector({
  choiceEffect,
  currentSelections,
  onSelect,
  label,
}: ChoiceSelectorProps) {
  const options = Array.isArray(choiceEffect.from)
    ? choiceEffect.from
    : [];
  const maxSelections = choiceEffect.choose;

  function handleToggle(option: string) {
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
              disabled={isDisabled}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDisabled
                    ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                    : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground cursor-pointer",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
