"use client";

import { useState } from "react";
import { X, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterState } from "@/lib/types/character";

// Core 5e conditions (excludes Exhaustion — handled separately as a leveled pill).
const BOOLEAN_CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
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

const EXHAUSTION_TOOLTIP =
  "1: Disadv on ability checks • 2: Speed halved • 3: Disadv on attacks + saves • 4: HP max halved • 5: Speed 0 • 6: Death";

interface ConditionsProps {
  conditions: string[];
  exhaustion: number;
  patchState: (patch: Partial<CharacterState>) => Promise<void> | void;
}

/**
 * Conditions widget (redesigned):
 * - Applied boolean conditions shown as pills with × removal
 * - Exhaustion shown as a leveled pill with [−]/[+] stepper when > 0
 * - "+ Add Condition" button opens a popover listing only unapplied conditions
 *   (Exhaustion is listed in the popover only when current level is 0)
 */
export function Conditions({ conditions, exhaustion, patchState }: ConditionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const exhaustionApplied = exhaustion > 0;
  const hasAnyApplied = conditions.length > 0 || exhaustionApplied;

  const removeCondition = (name: string) => {
    patchState({ conditions: conditions.filter((c) => c !== name) });
  };

  const addCondition = (name: string) => {
    setPickerOpen(false);
    if (name === "Exhaustion") {
      patchState({ exhaustion: 1 });
    } else {
      patchState({ conditions: [...conditions, name] });
    }
  };

  const incExhaustion = () => {
    patchState({ exhaustion: Math.min(6, exhaustion + 1) });
  };
  const decExhaustion = () => {
    patchState({ exhaustion: Math.max(0, exhaustion - 1) });
  };

  const availableConditions = BOOLEAN_CONDITIONS.filter(
    (c) => !conditions.includes(c),
  );
  const showExhaustionInPicker = !exhaustionApplied;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Conditions
      </h3>

      {!hasAnyApplied ? (
        <p className="text-xs text-muted-foreground italic">No active conditions</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => removeCondition(c)}
              aria-label={`Remove ${c}`}
              className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20 flex items-center gap-1"
            >
              {c}
              <X className="size-3" />
            </button>
          ))}
          {exhaustionApplied && (
            <div
              title={EXHAUSTION_TOOLTIP}
              className={cn(
                "text-xs px-2 py-1 rounded-md border flex items-center gap-1.5",
                exhaustion >= 5
                  ? "bg-destructive/20 text-destructive border-destructive"
                  : "bg-destructive/10 text-destructive border-destructive/50",
              )}
            >
              <span>Exhaustion</span>
              <button
                type="button"
                onClick={decExhaustion}
                aria-label="Decrease exhaustion"
                className="size-4 inline-flex items-center justify-center rounded hover:bg-destructive/20"
              >
                <Minus className="size-3" />
              </button>
              <span className="tabular-nums">{exhaustion}/6</span>
              <button
                type="button"
                onClick={incExhaustion}
                aria-label="Increase exhaustion"
                disabled={exhaustion >= 6}
                className="size-4 inline-flex items-center justify-center rounded hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="size-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="text-xs px-2 py-1 rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground hover:border-muted-foreground flex items-center gap-1"
        >
          <Plus className="size-3" />
          Add Condition
        </button>

        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
            <div className="max-h-60 overflow-y-auto">
              {availableConditions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addCondition(c)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
                >
                  {c}
                </button>
              ))}
              {showExhaustionInPicker && (
                <button
                  type="button"
                  onClick={() => addCondition("Exhaustion")}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
                  title={EXHAUSTION_TOOLTIP}
                >
                  Exhaustion
                </button>
              )}
              {availableConditions.length === 0 && !showExhaustionInPicker && (
                <p className="text-xs text-muted-foreground italic px-2 py-1">
                  All conditions applied
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
