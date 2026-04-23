"use client";

import { cn } from "@/lib/utils";
import { useSpells } from "@/lib/character/character-context";

type SlotKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "pact";

const SLOT_KEYS: SlotKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function SlotDots({ total, used }: { total: number; used: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-2 rounded-full",
            i < total - used
              ? "bg-primary"
              : "border border-primary/40 bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

function levelLabel(key: string): string {
  if (key === "pact") return "Pact";
  const n = parseInt(key, 10);
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function SlotTracker() {
  const { maxSlots, slotState } = useSpells();

  const visibleKeys: SlotKey[] = [];
  for (const k of SLOT_KEYS) {
    if ((maxSlots[k] ?? 0) > 0) visibleKeys.push(k);
  }
  if ((maxSlots.pact ?? 0) > 0) visibleKeys.push("pact");

  if (visibleKeys.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Slots
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {visibleKeys.map((k) => {
          const total = maxSlots[k] ?? 0;
          const used = slotState[k] ?? 0;
          return (
            <div key={k} className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground w-10">{levelLabel(k)}</span>
              <SlotDots total={total} used={used} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {total - used}/{total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
