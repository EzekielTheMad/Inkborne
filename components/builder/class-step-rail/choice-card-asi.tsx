"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { AsiChoice, AsiAllocation } from "@/lib/types/character";

interface ChoiceCardASIProps {
  featureSlug: string;
  currentChoice: AsiChoice | undefined;
  onSelect: (choice: AsiChoice) => void;
}

const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const ABBR: Record<(typeof ABILITIES)[number], string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

type Mode = "single" | "split";

function inferMode(allocations: AsiAllocation[] | undefined): Mode {
  if (!allocations || allocations.length === 0) return "single";
  return allocations.length === 1 ? "single" : "split";
}

export function ChoiceCardASI({ featureSlug, currentChoice, onSelect }: ChoiceCardASIProps) {
  const [mode, setMode] = useState<Mode>(inferMode(currentChoice?.allocations));
  const [splitPicks, setSplitPicks] = useState<string[]>(() =>
    (currentChoice?.allocations ?? []).filter((a) => a.amount === 1).map((a) => a.ability),
  );

  // If parent state changes externally, sync.
  useEffect(() => {
    setMode(inferMode(currentChoice?.allocations));
    setSplitPicks((currentChoice?.allocations ?? []).filter((a) => a.amount === 1).map((a) => a.ability));
  }, [currentChoice, featureSlug]);

  const isMade = !!currentChoice && currentChoice.allocations.length > 0;

  function pickSingle(ability: string) {
    onSelect({ mode: "asi", allocations: [{ ability, amount: 2 }] });
  }

  function toggleSplit(ability: string) {
    let next: string[];
    if (splitPicks.includes(ability)) {
      next = splitPicks.filter((a) => a !== ability);
    } else if (splitPicks.length < 2) {
      next = [...splitPicks, ability];
    } else {
      // Drop the first, add the new — keep at most 2 picks.
      next = [splitPicks[1], ability];
    }
    setSplitPicks(next);
    onSelect({
      mode: "asi",
      allocations: next.map((a) => ({ ability: a, amount: 1 })),
    });
  }

  return (
    <article className="rounded-md border border-border bg-card/40 p-4" data-feature-slug={featureSlug}>
      <header className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">Ability Score Improvement</h4>
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

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode("single")}
          aria-pressed={mode === "single"}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs border transition-colors",
            mode === "single" ? "bg-accent/15 border-accent/50 text-accent" : "bg-transparent border-border text-muted-foreground hover:text-foreground",
          )}
        >
          One ability by +2
        </button>
        <button
          type="button"
          onClick={() => setMode("split")}
          aria-pressed={mode === "split"}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs border transition-colors",
            mode === "split" ? "bg-accent/15 border-accent/50 text-accent" : "bg-transparent border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Two abilities by +1
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const label = ABBR[ability];
          if (mode === "single") {
            const selected =
              currentChoice?.allocations.length === 1 &&
              currentChoice.allocations[0].ability === ability &&
              currentChoice.allocations[0].amount === 2;
            return (
              <button
                key={ability}
                type="button"
                aria-pressed={selected}
                onClick={() => pickSingle(ability)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  selected ? "border-accent bg-accent/10 text-accent" : "border-border bg-card/30 hover:border-accent/50",
                )}
              >
                {label} +2
              </button>
            );
          }
          // split mode
          const selected = splitPicks.includes(ability);
          return (
            <button
              key={ability}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleSplit(ability)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                selected ? "border-accent bg-accent/10 text-accent" : "border-border bg-card/30 hover:border-accent/50",
              )}
            >
              {label} +1
            </button>
          );
        })}
      </div>
    </article>
  );
}
