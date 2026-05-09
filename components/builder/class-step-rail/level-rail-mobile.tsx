"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { ClassEmblem } from "@/components/builder/class-emblem";
import { LevelPill } from "@/components/builder/class-step-rail/level-pill";
import { LevelUpButton } from "@/components/builder/class-step-rail/level-up-button";
import { LevelRailSetLevelSheet } from "@/components/builder/class-step-rail/level-rail-set-level-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PerLevel } from "@/lib/builder/class-features-per-level";

interface LevelRailMobileProps {
  classSlug: string;
  className_: string;
  subclassName?: string;
  currentLevel: number;
  perLevel: PerLevel[];
  activeLevel: number;
  onSelectLevel: (level: number) => void;
  onLevelChange: (newLevel: number) => Promise<void> | void;
  onRemoveClass: () => Promise<void> | void;
  onLevelUpClick: () => void;
  levelUpButtonState: "idle" | "disabled" | "active-flow";
  levelUpButtonReason?: string;
  disabled?: boolean;
  className?: string;
}

const MAX_LEVEL = 20;

export function LevelRailMobile(props: LevelRailMobileProps) {
  const {
    classSlug, className_, subclassName, currentLevel, perLevel,
    activeLevel, onSelectLevel, onLevelChange, onRemoveClass,
    onLevelUpClick, levelUpButtonState, levelUpButtonReason,
    disabled = false, className,
  } = props;

  const [setLevelOpen, setSetLevelOpen] = useState(false);

  const handleRemove = () => {
    if (!window.confirm(`Remove ${className_} from this character? This will also remove any subclass and choices made for it.`)) return;
    void onRemoveClass();
  };

  return (
    <div className={cn("border-b border-border bg-background/40", className)}>
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <ClassEmblem slug={classSlug} name={className_} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{className_}</p>
          {subclassName && (
            <p className="truncate text-[10.5px] text-muted-foreground">{subclassName}</p>
          )}
        </div>
        <span className="text-[10.5px] tabular-nums text-muted-foreground">Lv {currentLevel}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSetLevelOpen(true)}
          disabled={disabled}
          className="h-7 px-2 text-[10.5px]"
        >
          Set level
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More options for ${className_}`}
            disabled={disabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleRemove} className="text-destructive">
              Remove {className_}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        role="navigation"
        aria-label={`${className_} levels`}
        className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scroll-snap-type:x_proximity] [scrollbar-width:none]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {perLevel.map((row) => (
          <div key={row.level} className="shrink-0 [scroll-snap-align:center]">
            <LevelPill
              level={row.level}
              summary={row.features[0]?.name ?? row.choices[0]?.label ?? ""}
              hasUnmadeChoice={row.choices.some((c) => !c.isMade)}
              active={row.level === activeLevel}
              onClick={() => {
                if (disabled) return;
                onSelectLevel(row.level);
              }}
            />
          </div>
        ))}
        <div className="shrink-0">
          <LevelUpButton
            state={disabled ? "disabled" : levelUpButtonState}
            classSlug={classSlug}
            classLabel={className_}
            atLevel={currentLevel}
            reason={levelUpButtonReason}
            onClick={onLevelUpClick}
          />
        </div>
      </div>

      <LevelRailSetLevelSheet
        open={setLevelOpen}
        onOpenChange={setSetLevelOpen}
        classSlug={classSlug}
        className_={className_}
        classIndex={0}
        currentLevel={currentLevel}
        maxLevel={MAX_LEVEL}
        onLevelChange={(_classIndex, newLevel) => {
          void onLevelChange(newLevel);
        }}
      />
    </div>
  );
}
