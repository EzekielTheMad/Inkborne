"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { useRolls } from "@/lib/character/character-context";
import type { RollLogEntry } from "@/lib/types/rolls";
import { RollBreakdown } from "@/components/sheet/rolls/roll-breakdown";
import { cn } from "@/lib/utils";

/** How long an unpinned roll toast stays on screen. */
export const ROLL_TOAST_DURATION_MS = 6000;

/**
 * Transient roll-result stack: bottom-right on desktop, bottom-center above
 * the tab bar on mobile. Purpose-built for rolls — not a general toast system
 * and not a new dependency (design §3.4). Toasts auto-dismiss after ~6s;
 * clicking one pins it open until explicitly dismissed.
 */
export function RollToaster() {
  const { rolls } = useRolls();
  const [toasts, setToasts] = useState<RollLogEntry[]>([]);

  // Seed with mount-time rolls so hydrated history never toasts.
  const seenIds = useRef<Set<string> | null>(null);
  if (seenIds.current === null) {
    seenIds.current = new Set(rolls.map((r) => r.id));
  }

  useEffect(() => {
    const seen = seenIds.current!;
    const fresh = rolls.filter((r) => !seen.has(r.id));
    if (fresh.length === 0) return;
    for (const r of fresh) seen.add(r.id);
    // rolls is newest-first; append oldest-fresh first so the newest toast
    // ends up at the bottom of the stack (closest to where the eye rests).
    setToasts((prev) => [...prev, ...fresh.slice().reverse()]);
  }, [rolls]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div
      aria-live="polite"
      aria-label="Roll results"
      className={cn(
        "pointer-events-none fixed z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2",
        // Desktop: bottom-right stack.
        "bottom-4 right-4",
        // Mobile: bottom-center, above the tab bar.
        "max-md:bottom-20 max-md:left-1/2 max-md:right-auto max-md:-translate-x-1/2",
      )}
    >
      {toasts.map((entry) => (
        <RollToast key={entry.id} entry={entry} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function RollToast({
  entry,
  onDismiss,
}: {
  entry: RollLogEntry;
  onDismiss: (id: string) => void;
}) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned) return;
    const timer = setTimeout(() => onDismiss(entry.id), ROLL_TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [pinned, entry.id, onDismiss]);

  const natural = entry.result.natural;
  const isCrit = natural === 20;
  const isFumble = natural === 1;

  return (
    <div
      role="status"
      data-testid="roll-toast"
      data-pinned={pinned || undefined}
      onClick={() => setPinned(true)}
      className={cn(
        "pointer-events-auto cursor-pointer rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
        isCrit && "border-emerald-500/60 ring-1 ring-emerald-500/40",
        isFumble && "border-destructive/60 ring-1 ring-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {entry.label}
          </p>
          <p className="text-2xl font-bold leading-tight tabular-nums">
            {entry.total}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isCrit && (
            <span className="text-xs font-semibold text-emerald-500">
              Critical!
            </span>
          )}
          {isFumble && (
            <span className="text-xs font-semibold text-destructive">
              Fumble
            </span>
          )}
          {pinned && (
            <button
              type="button"
              aria-label="Dismiss roll"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(entry.id);
              }}
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </div>
      <RollBreakdown result={entry.result} className="mt-1" />
    </div>
  );
}
