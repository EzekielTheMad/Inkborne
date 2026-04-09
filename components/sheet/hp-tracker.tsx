"use client";

import { useState, useRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CharacterState } from "@/lib/types/character";

interface HPTrackerProps {
  currentHp: number;
  maxHp: number;
  tempHp: number;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
}

function getHpColor(currentHp: number, maxHp: number): string {
  if (maxHp === 0) return "text-foreground";
  if (currentHp === 0) return "text-destructive font-bold";
  const pct = currentHp / maxHp;
  if (pct <= 0.25) return "text-destructive";
  if (pct <= 0.5) return "text-accent";
  return "text-foreground";
}

export function HPTracker({
  currentHp,
  maxHp,
  tempHp,
  patchState,
}: HPTrackerProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hpColor = getHpColor(currentHp, maxHp);

  function getAmount(): number {
    const n = parseInt(inputValue, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function applyDamage() {
    const amount = getAmount();
    if (amount === 0) return;

    let remaining = amount;
    let newTemp = tempHp;
    let newCurrent = currentHp;

    if (newTemp > 0) {
      const absorbed = Math.min(newTemp, remaining);
      newTemp -= absorbed;
      remaining -= absorbed;
    }
    newCurrent = Math.max(0, newCurrent - remaining);

    patchState({ current_hp: newCurrent, temp_hp: newTemp });
    setInputValue("");
    setOpen(false);
  }

  function applyHeal() {
    const amount = getAmount();
    if (amount === 0) return;

    const newCurrent = Math.min(maxHp, currentHp + amount);
    patchState({ current_hp: newCurrent });
    setInputValue("");
    setOpen(false);
  }

  function setTemp() {
    const amount = getAmount();
    patchState({ temp_hp: amount });
    setInputValue("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      applyHeal();
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          // Auto-focus the input after popover opens
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
    >
      <PopoverPrimitive.Trigger
        className={cn(
          "rounded-lg border border-border bg-card p-3 text-center min-w-[90px] cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label="HP tracker — click to heal or damage"
      >
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          HP
        </p>
        <p className={cn("text-2xl font-bold leading-tight", hpColor)}>
          {currentHp}
          <span className="text-sm font-normal text-muted-foreground">
            /{maxHp}
          </span>
        </p>
        {tempHp > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Temp: {tempHp}
          </p>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="center" sideOffset={8}>
          <PopoverPrimitive.Popup
            className={cn(
              "z-50 w-52 rounded-xl bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              HP: {currentHp} / {maxHp}
              {tempHp > 0 && ` (${tempHp} temp)`}
            </p>

            <Input
              ref={inputRef}
              type="number"
              min={0}
              placeholder="Amount"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="mb-3 text-center"
            />

            <div className="flex flex-col gap-1.5">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={applyDamage}
              >
                Damage
              </Button>
              <Button
                size="sm"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={applyHeal}
              >
                Heal
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={setTemp}
              >
                Set Temp HP
              </Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
