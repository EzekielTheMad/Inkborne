"use client";

import { cn } from "@/lib/utils";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import type { ChoiceEffect } from "@/lib/types/effects";

interface ChoiceCardGenericProps {
  choiceEffect: ChoiceEffect;
  currentSelections: string[];
  onSelect: (selections: string[]) => void;
  /** Optional override label (defaults to the auto-generated label inside ChoiceSelector). */
  label?: string;
}

export function ChoiceCardGeneric({
  choiceEffect,
  currentSelections,
  onSelect,
  label,
}: ChoiceCardGenericProps) {
  const isMade = currentSelections.length >= choiceEffect.choose;

  return (
    <article className="rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">
          {label ?? `Choose ${choiceEffect.choose} ${choiceEffect.grant_type.replace(/_/g, " ")}`}
        </h4>
        <span
          aria-label={isMade ? "Choice made" : "Choice not yet made"}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
            isMade ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive",
          )}
        >
          {isMade ? "Chosen" : "Choose"}
        </span>
      </header>
      <ChoiceSelector
        choiceEffect={choiceEffect}
        currentSelections={currentSelections}
        onSelect={onSelect}
      />
    </article>
  );
}
