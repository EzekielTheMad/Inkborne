"use client";

import { cn } from "@/lib/utils";
import type { CharacterState } from "@/lib/types/character";

const DND_CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;

interface ConditionsProps {
  conditions: string[];
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
}

export function Conditions({ conditions, patchState }: ConditionsProps) {
  function toggleCondition(condition: string) {
    const isActive = conditions.includes(condition);
    patchState({
      conditions: isActive
        ? conditions.filter((c) => c !== condition)
        : [...conditions, condition],
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Conditions
      </h3>

      <div className="flex flex-wrap gap-1.5">
        {DND_CONDITIONS.map((condition) => {
          const isActive = conditions.includes(condition);
          return (
            <button
              key={condition}
              type="button"
              onClick={() => toggleCondition(condition)}
              className={cn(
                "text-xs px-2 py-1 rounded-md border cursor-pointer transition-colors",
                isActive
                  ? "bg-destructive/10 text-destructive border-destructive/50"
                  : "bg-muted text-muted-foreground border-border hover:border-muted-foreground/50",
              )}
              aria-pressed={isActive}
            >
              {condition}
            </button>
          );
        })}
      </div>
    </div>
  );
}
