"use client";

import { useState, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { useRolls, useActiveEffects } from "@/lib/character/character-context";
import { collectRollModifiers } from "@/lib/active-effects/helpers";
import {
  buildD20RollRequest,
  buildImmediateRollRequest,
  describeD20Roll,
  isD20RollKind,
  rollModifierKindFor,
} from "@/lib/rolls/requests";
import type { RollKind, RollMode, RollResult, RollRequest } from "@/lib/dice/types";
import { cn } from "@/lib/utils";
import type { MechanicsRequirement } from "@/lib/character/ability-mechanics";

export interface RollPopoverProps {
  mechanicsRequirement?: MechanicsRequirement;
  kind: RollKind;
  /** Roll label, e.g. "Athletics Check", "Longsword — Attack". */
  label: string;
  /** Flat bonus for d20 kinds. Omit for unmodified rolls (death saves). */
  modifier?: number;
  /** Complete dice expression for immediate kinds (damage/heal/hit dice). */
  expression?: string;
  /** Damage rolls: double the dice — armed by a preceding nat-20 attack. */
  crit?: boolean;
  meta?: Record<string, unknown>;
  onResult?: (result: RollResult) => void;
  /** Caller owns gating, RNG/logging and persistence; replaces default rolling. */
  onRollRequest?: (request: RollRequest) => void;
  disabled?: boolean;
  /** Trigger element classes — callers keep their existing stat styling. */
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

/** Shared affordance styling for every rollable stat trigger. */
const TRIGGER_INTERACTION_CLASSES =
  "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60";

/**
 * Reusable roll trigger (M3 T3, decision D1): the child renders the stat as
 * today; clicking it either opens a compact Normal/Advantage/Disadvantage
 * popover (d20 kinds — adv/dis is the single most common table adjustment)
 * or rolls immediately (damage kinds, which have no adv/dis).
 *
 * Active-effect roll riders (Bless's +1d4, Bane's −1d4…) are collected at
 * roll time via `collectRollModifiers`, appended to the expression, and named
 * in the breakdown. The same Base UI popover works on mobile (HP-tracker
 * precedent), so `MobileSheet`'s mirrored surfaces need no extra work.
 */
export function RollPopover({
  mechanicsRequirement,
  kind,
  label,
  modifier,
  expression,
  crit,
  meta,
  onResult,
  onRollRequest,
  disabled,
  className,
  ariaLabel,
  children,
}: RollPopoverProps) {
  const { roll, assertMechanics, mechanics } = useRolls();
  const { activeEffects } = useActiveEffects();
  const [open, setOpen] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);
  const dependent = mechanicsRequirement !== undefined || ["check", "save", "attack", "initiative", "hit_die", "concentration"].includes(kind);
  const blocked = disabled || (dependent && (mechanics?.status !== "available" || !mechanicsRequirement));

  // Immediate kinds: one click, one roll — no popover (design §3.4).
  if (!isD20RollKind(kind)) {
    const executeImmediate = () => {
      if (blocked) return;
      try {
        if (dependent) assertMechanics(mechanicsRequirement);
        const request = buildImmediateRollRequest({ kind, label, expression: expression ?? "", crit, meta });
        if (onRollRequest) onRollRequest(request);
        else { const result = roll(request, mechanicsRequirement); onResult?.(result); }
        setRollError(null);
      } catch (cause) { setRollError(cause instanceof Error ? cause.message : "Reload before using this saved roll."); }
    };

    return (
      <><button
        type="button"
        onClick={executeImmediate}
        disabled={blocked}
        aria-label={ariaLabel ?? `Roll ${label}`}
        className={cn(TRIGGER_INTERACTION_CLASSES, className)}
      >
        {children}
      </button>{rollError && <span role="alert" className="text-xs text-destructive">{rollError}</span>}</>
    );
  }

  const rollModifiers = collectRollModifiers(
    activeEffects,
    rollModifierKindFor(kind),
  );

  const executeD20 = (mode: RollMode) => {
    if (blocked) return;
    try {
      if (dependent) assertMechanics({ ...mechanicsRequirement, values: [...(mechanicsRequirement?.values ?? []), modifier!] });
      const request = buildD20RollRequest({ kind, label, modifier, mode,
        rollModifiers: collectRollModifiers(activeEffects, rollModifierKindFor(kind)), meta });
      if (onRollRequest) onRollRequest(request);
      else { const result = roll(request, mechanicsRequirement); onResult?.(result); }
      setRollError(null); setOpen(false);
    } catch (cause) { setRollError(cause instanceof Error ? cause.message : "Reload before using this saved roll."); }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        disabled={blocked}
        aria-label={ariaLabel ?? `Roll ${label}`}
        className={cn(TRIGGER_INTERACTION_CLASSES, className)}
      >
        {children}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="center" sideOffset={8}>
          <PopoverPrimitive.Popup
            className={cn(
              "z-50 w-48 rounded-xl bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <p className="mb-0.5 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {/* The computed bonus, shown for transparency (design §3.4). */}
            <p className="mb-2.5 text-sm tabular-nums text-foreground">
              {describeD20Roll(modifier, rollModifiers)}
            </p>
            <div className="flex flex-col gap-1.5">
              {rollError && <p role="alert" className="text-xs text-destructive">{rollError}</p>}
              <Button
                size="sm"
                className="w-full bg-character-fg text-background hover:opacity-90"
                disabled={blocked}
                onClick={() => executeD20("normal")}
              >
                Roll
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-emerald-500/40 text-emerald-500 hover:text-emerald-400"
                disabled={blocked}
                onClick={() => executeD20("advantage")}
              >
                Advantage
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-destructive/40 text-destructive hover:text-destructive"
                disabled={blocked}
                onClick={() => executeD20("disadvantage")}
              >
                Disadvantage
              </Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
