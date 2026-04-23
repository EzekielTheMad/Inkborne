"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterSpell } from "@/lib/types/spells";
import { SpellRow } from "@/components/sheet/spells/spell-row";

interface SpellLevelSectionProps {
  level: number;
  spells: CharacterSpell[];
  maxSlots?: number;
  usedSlots?: number;
  isPactSection?: boolean;
  defaultOpen?: boolean;
  /** Whether to show prepare checkboxes on non-always-prepared, non-cantrip spells. */
  allowPrepareToggle: boolean;
  onTogglePrepared: (spell: CharacterSpell) => void;
  onRemove: (spell: CharacterSpell) => void;
}

function levelTitle(level: number, isPact: boolean): string {
  if (level === 0) return "Cantrips";
  if (isPact) return `Pact Slots (level ${level})`;
  if (level === 1) return "1st Level";
  if (level === 2) return "2nd Level";
  if (level === 3) return "3rd Level";
  return `${level}th Level`;
}

export function SpellLevelSection({
  level,
  spells,
  maxSlots,
  usedSlots,
  isPactSection = false,
  defaultOpen = false,
  allowPrepareToggle,
  onTogglePrepared,
  onRemove,
}: SpellLevelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const slotSummary =
    maxSlots && maxSlots > 0
      ? ` (${(usedSlots ?? 0)}/${maxSlots} used)`
      : "";

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-accent/10 transition-colors"
      >
        <span className="flex items-center gap-2">
          {levelTitle(level, isPactSection)}
          <span className="text-xs text-muted-foreground">
            ({spells.length}){slotSummary}
          </span>
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {spells.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">No spells at this level.</p>
          ) : (
            spells.map((spell) => (
              <SpellRow
                key={spell.id}
                spell={spell}
                allowPrepareToggle={allowPrepareToggle}
                onTogglePrepared={() => onTogglePrepared(spell)}
                onRemove={() => onRemove(spell)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
