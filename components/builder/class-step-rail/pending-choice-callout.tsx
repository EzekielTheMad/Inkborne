"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { pendingChoicesUpTo, type PerLevel } from "@/lib/builder/class-features-per-level";

interface PendingChoiceCalloutProps {
  /** Rendered rows for this class rail (already clipped to the current level + optional draft row). */
  perLevel: PerLevel[];
  /** Current persisted level of the class — pending choices above it are ignored. */
  currentLevel: number;
  /** Navigate to the level that holds the pending choice (same target as clicking its pill). */
  onGoToLevel: (level: number) => void;
  /** Hidden while the rail is locked by an active level-up flow. */
  disabled?: boolean;
  className?: string;
}

/**
 * Visible affordance for required-but-unmade level choices (subclass, ASI,
 * fighting style, …) — UAT A3. Renders one gold "Choose your {label}" button
 * per pending choice; clicking navigates to that level row, where the same
 * choice cards used by the level-up flow are rendered.
 */
export function PendingChoiceCallout({
  perLevel,
  currentLevel,
  onGoToLevel,
  disabled = false,
  className,
}: PendingChoiceCalloutProps) {
  if (disabled) return null;
  const pending = pendingChoicesUpTo(perLevel, currentLevel);
  if (pending.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {pending.map(({ level, choice }) => (
        <button
          key={`${level}-${choice.type}-${choice.featureSlug ?? choice.label}`}
          type="button"
          aria-label={`Choose your ${choice.label}`}
          onClick={() => onGoToLevel(level)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors",
            "border-[rgba(201,164,74,0.4)] bg-[rgba(201,164,74,0.12)] text-[#c9a44a] hover:bg-[rgba(201,164,74,0.2)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Choose your {choice.label}</span>
          <span aria-hidden="true" className="text-[10px] tabular-nums opacity-80">
            Lv {level}
          </span>
        </button>
      ))}
    </div>
  );
}
