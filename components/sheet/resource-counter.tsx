"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureResource } from "@/lib/types/resources";

interface ResourceCounterProps {
  resource: FeatureResource;
  used: number;
  onChange: (newUsed: number) => void;
  layout?: "widget" | "card";
}

/**
 * Shared counter UI for a single feature resource.
 * - widget: compact inline row (used in the left-column ResourcesWidget)
 * - card:   slightly roomier, includes source label (used on Features tab cards)
 */
export function ResourceCounter({
  resource,
  used,
  onChange,
  layout = "widget",
}: ResourceCounterProps) {
  // Counter displays remaining/max (how many are left, not how many are used).
  // Minus icon → decrements remaining (increments `used`).
  // Plus icon → restores remaining (decrements `used`).
  const remaining = Math.max(0, Math.min(resource.max, resource.max - used));
  const exhausted = remaining === 0;
  const noneSpent = used <= 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        layout === "widget" ? "text-sm" : "text-sm rounded border border-border/60 bg-muted/20 px-2 py-1.5",
        exhausted && "opacity-60",
      )}
    >
      <span className={cn("flex-1 min-w-0 truncate", layout === "card" && "font-medium")}>
        {resource.name}
        {layout === "card" && (
          <span className="ml-2 text-xs text-muted-foreground">{resource.sourceLabel}</span>
        )}
      </span>
      <span className="tabular-nums text-muted-foreground shrink-0">
        {remaining}/{resource.max}
      </span>
      <button
        type="button"
        onClick={() => onChange(used + 1)}
        disabled={exhausted}
        aria-label={`Use one ${resource.name}`}
        className={cn(
          "size-5 rounded border border-border flex items-center justify-center shrink-0",
          "text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground",
        )}
      >
        <Minus className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => onChange(used - 1)}
        disabled={noneSpent}
        aria-label={`Restore one ${resource.name}`}
        className={cn(
          "size-5 rounded border border-border flex items-center justify-center shrink-0",
          "text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground",
        )}
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
