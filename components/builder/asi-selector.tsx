"use client";

import { cn } from "@/lib/utils";
import type { AsiChoice, AsiAllocation } from "@/lib/types/character";

const ABILITY_SCORES = [
  { slug: "strength", name: "Strength", abbr: "STR" },
  { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
  { slug: "constitution", name: "Constitution", abbr: "CON" },
  { slug: "intelligence", name: "Intelligence", abbr: "INT" },
  { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
  { slug: "charisma", name: "Charisma", abbr: "CHA" },
] as const;

interface AsiSelectorProps {
  featureSlug: string;
  currentChoice: AsiChoice | undefined;
  onSelect: (choice: AsiChoice) => void;
}

/**
 * Interactive selector for Ability Score Improvement features.
 * Allows +2 to one ability OR +1 to two abilities (total budget of 2).
 */
export function AsiSelector({
  featureSlug: _featureSlug,
  currentChoice,
  onSelect,
}: AsiSelectorProps) {
  const allocations: AsiAllocation[] = currentChoice?.allocations ?? [];

  const totalSpent = allocations.reduce((sum, a) => sum + a.amount, 0);

  function getAllocationFor(ability: string): number {
    return allocations.find((a) => a.ability === ability)?.amount ?? 0;
  }

  function handleIncrement(ability: string) {
    const current = getAllocationFor(ability);

    // Cannot exceed +2 on a single score or total budget of 2
    if (current >= 2 || totalSpent >= 2) return;

    // If incrementing to +2, this must be the only allocation
    if (current === 1 && totalSpent === 1) {
      // Going +1 -> +2 is fine (uses full budget on one score)
      const updated: AsiAllocation[] = [{ ability, amount: 2 }];
      onSelect({ mode: "asi", allocations: updated });
      return;
    }

    // If already have a +2 somewhere, can't add elsewhere
    if (allocations.some((a) => a.amount === 2)) return;

    // Add +1 to this ability
    const existing = allocations.filter((a) => a.ability !== ability);
    const updated = [...existing, { ability, amount: current + 1 }];
    onSelect({ mode: "asi", allocations: updated });
  }

  function handleDecrement(ability: string) {
    const current = getAllocationFor(ability);
    if (current <= 0) return;

    if (current === 1) {
      // Remove allocation
      const updated = allocations.filter((a) => a.ability !== ability);
      onSelect({ mode: "asi", allocations: updated });
    } else {
      // Reduce from +2 to +1
      const existing = allocations.filter((a) => a.ability !== ability);
      const updated = [...existing, { ability, amount: current - 1 }];
      onSelect({ mode: "asi", allocations: updated });
    }
  }

  function handleReset() {
    onSelect({ mode: "asi", allocations: [] });
  }

  return (
    <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Ability Score Improvement
        </p>
        <span className="text-xs text-muted-foreground">
          {totalSpent} / 2 points used
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Increase one ability by 2, or two abilities by 1 each.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ABILITY_SCORES.map((ability) => {
          const amount = getAllocationFor(ability.slug);
          const canIncrement =
            totalSpent < 2 &&
            amount < 2 &&
            !(amount === 0 && totalSpent === 1 && allocations.some((a) => a.amount === 2));

          return (
            <div
              key={ability.slug}
              className={cn(
                "flex items-center justify-between rounded-md border p-2 transition-colors",
                amount > 0
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card",
              )}
            >
              <div className="flex flex-col">
                <span className="text-xs font-medium">{ability.abbr}</span>
                <span className="text-[10px] text-muted-foreground">
                  {ability.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDecrement(ability.slug)}
                  disabled={amount <= 0}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-colors",
                    amount > 0
                      ? "bg-muted text-foreground hover:bg-muted-foreground/20"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                  )}
                  aria-label={`Decrease ${ability.name}`}
                >
                  -
                </button>
                <span
                  className={cn(
                    "w-6 text-center text-sm font-semibold",
                    amount > 0 ? "text-accent" : "text-muted-foreground",
                  )}
                >
                  {amount > 0 ? `+${amount}` : "0"}
                </span>
                <button
                  type="button"
                  onClick={() => handleIncrement(ability.slug)}
                  disabled={!canIncrement}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-colors",
                    canIncrement
                      ? "bg-muted text-foreground hover:bg-muted-foreground/20"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                  )}
                  aria-label={`Increase ${ability.name}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalSpent > 0 && (
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
