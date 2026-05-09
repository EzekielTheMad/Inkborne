"use client";

import { Trash2 } from "lucide-react";
import { ClassEmblem } from "@/components/builder/class-emblem";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

interface LevelRailProps {
  classSlug: string;
  className_: string;
  subclassName: string | undefined;
  currentLevel: number;
  perLevel: PerLevel[];
  activeLevel: number;
  onSelectLevel: (level: number) => void;
  onLevelChange: (newLevel: number) => void;
  onRemoveClass?: () => void;
}

function summarizeLevel(row: PerLevel): string {
  const primary = row.choices[0];
  if (primary) {
    if (primary.type === "asi") return "ASI";
    if (primary.type === "fighting-style") return "Fighting Style";
    return primary.label;
  }
  if (row.features.length === 1) return row.features[0].name;
  if (row.features.length > 1) return `${row.features.length} features`;
  return `Level ${row.level}`;
}

export function LevelRail({
  classSlug,
  className_,
  subclassName,
  currentLevel,
  perLevel,
  activeLevel,
  onSelectLevel,
  onLevelChange,
  onRemoveClass,
}: LevelRailProps) {
  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2 px-2 py-1.5">
        <ClassEmblem slug={classSlug} name={className_} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{className_}</p>
          {subclassName && (
            <p className="text-[11px] text-muted-foreground truncate">{subclassName}</p>
          )}
        </div>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="sr-only">Set level for {className_}</span>
          <select
            aria-label={`Set level for ${className_}`}
            value={currentLevel}
            onChange={(e) => onLevelChange(parseInt(e.target.value, 10))}
            className="h-6 rounded-md border border-input bg-background px-1.5 text-xs"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </label>
        {onRemoveClass && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove ${className_} from this character? This will also remove any subclass and choices made for it.`)) {
                onRemoveClass();
              }
            }}
            aria-label={`Remove ${className_}`}
            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`Remove ${className_}`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="flex flex-col gap-1">
        {perLevel.map((row) => (
          <LevelPill
            key={row.level}
            level={row.level}
            summary={summarizeLevel(row)}
            hasUnmadeChoice={row.choices.some((c) => !c.isMade)}
            active={activeLevel === row.level}
            onClick={() => onSelectLevel(row.level)}
          />
        ))}
      </div>
    </section>
  );
}
