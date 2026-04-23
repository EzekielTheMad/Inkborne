"use client";

import { X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpells } from "@/lib/character/character-context";

export function ConcentrationBadge() {
  const { concentration, setConcentration } = useSpells();
  if (!concentration) return null;

  return (
    <div className="flex items-center gap-2 rounded-full bg-purple-950/60 border border-purple-500/50 px-3 py-1 text-xs text-purple-200">
      <Brain className="size-3.5" />
      <span>
        Concentrating: <span className="font-medium">{concentration.spell_name}</span>{" "}
        ({concentration.slot_level === 0 ? "cantrip" : `${concentration.slot_level} slot`})
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
