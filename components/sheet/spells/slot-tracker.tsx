"use client";

import { useState } from "react";
import { useDialogAction } from "@/lib/character/use-dialog-action";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { cn } from "@/lib/utils";
import { useCharacterState, useSpells } from "@/lib/character/character-context";
import type { SpellSlotsUsed } from "@/lib/types/spells";

type SlotKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "pact";

const SLOT_KEYS: SlotKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function levelLabel(key: string): string {
  if (key === "pact") return "Pact";
  const n = parseInt(key, 10);
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

/**
 * Click-to-toggle slot dots (design §4.5, closes Phase 1's "interactive slot
 * consumption" deferral): clicking an available dot marks one slot used
 * ("I cast it in the hallway conversation, just dock the slot"); clicking a
 * used dot restores it. Same `patchState` shape as the cast dialog.
 */
function SlotDots({
  slotKey,
  total,
  used,
  onSetUsed,
  pending,
}: {
  slotKey: SlotKey;
  total: number;
  used: number;
  onSetUsed: (next: number) => void;
  pending: boolean;
}) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => {
        const available = i < total - used;
        return (
          <button
            key={i}
            type="button"
            disabled={pending}
            onClick={() =>
              onSetUsed(
                available
                  ? Math.min(total, used + 1)
                  : Math.max(0, used - 1),
              )
            }
            aria-label={
              available
                ? `Mark ${levelLabel(slotKey)} slot used`
                : `Restore ${levelLabel(slotKey)} slot`
            }
            className={cn(
              "inline-block size-2 rounded-full transition-transform hover:scale-125",
              available
                ? "bg-character-fg"
                : "border border-character-border bg-transparent",
            )}
          />
        );
      })}
    </span>
  );
}

export function SlotTracker() {
  const { maxSlots, slotState, slotResolution } = useSpells();
  const { state, patchState } = useCharacterState();
  const { pending, run } = useDialogAction();
  const [saveError, setSaveError] = useState<string | null>(null);

  const visibleKeys: SlotKey[] = [];
  for (const k of SLOT_KEYS) {
    if ((maxSlots[k] ?? 0) > 0) visibleKeys.push(k);
  }
  if ((maxSlots.pact ?? 0) > 0) visibleKeys.push("pact");

  if (slotResolution?.status !== "available") return <p role="status" className="text-sm text-muted-foreground">Spell slots are unavailable. Reload the character or restore its saved class content.</p>;
  if (slotResolution?.status !== "available") return <p role="status" className="text-sm text-muted-foreground">Spell slots are unavailable. Reload the character or restore its saved class content.</p>;
  if (visibleKeys.length === 0) return null;

  const setUsed = (key: SlotKey, next: number) => {
    setSaveError(null);
    void run(() => patchState.runAction(state, (confirmed) => {
      const slots = (confirmed.spell_slots_used ?? {}) as SpellSlotsUsed;
      return { patch: { spell_slots_used: { ...slots, [key]: next } }, result: true };
    }, { requireCurrent: true }), () => {}, (error) => {
      setSaveError(error instanceof CharacterStateReloadError
        ? error.message
        : "This slot change could not be saved. Wait for any pending character save to finish, then try again.");
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2" aria-busy={pending}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Slots
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {visibleKeys.map((k) => {
          const total = maxSlots[k] ?? 0;
          const used = Math.min(slotState[k] ?? 0, total);
          return (
            <div key={k} className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground w-10">{levelLabel(k)}</span>
              <SlotDots
                slotKey={k}
                pending={pending}
                total={total}
                used={used}
                onSetUsed={(next) => setUsed(k, next)}
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {total - used}/{total}
              </span>
            </div>
          );
        })}
      </div>
      {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}
    </div>
  );
}
