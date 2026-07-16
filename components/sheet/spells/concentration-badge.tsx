"use client";

import { X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveEffects, useSpells } from "@/lib/character/character-context";

export function ConcentrationBadge() {
  const { concentration, setConcentration } = useSpells();
  const { activeEffects } = useActiveEffects();
  if (!concentration) return null;

  // Effects that ending concentration will remove. The ✕ goes through
  // setConcentration(null), which applies the full atomic drop patch
  // (concentrating_on cleared + these effects stripped in ONE write, T7).
  const linkedNames = activeEffects
    .filter((e) => e.concentration)
    .map((e) => e.name);

  return (
    <div className="flex items-center gap-2 rounded-full bg-purple-950/60 border border-purple-500/50 px-3 py-1 text-xs text-purple-200">
      <Brain className="size-3.5" />
      <span>
        Concentrating: <span className="font-medium">{concentration.spell_name}</span>{" "}
        ({concentration.slot_level === 0 ? "cantrip" : `${concentration.slot_level} slot`})
        {linkedNames.length > 0 && (
          <span className="text-purple-300/80">
            {" "}
            · ending removes {linkedNames.join(", ")}
          </span>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 hover:bg-purple-800/50"
        onClick={() => setConcentration(null)}
        aria-label="End concentration"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
