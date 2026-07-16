"use client";

import { useState } from "react";
import { Dices, Minus, Moon, Plus, Sparkles, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRest, useCharacter, useCharacterState, useResources } from "@/lib/character/character-context";
import { computeLongRestHdRecovery, formatClassSlug } from "@/lib/hit-dice/helpers";
import { totalPickedLevels, type ArcaneRecoveryPicks } from "@/lib/rest/arcane-recovery";
import type { ConcentrationState } from "@/lib/types/spells";

interface RestDialogProps {
  open: boolean;
  onClose: () => void;
}

function ordinal(level: number): string {
  if (level === 1) return "1st";
  if (level === 2) return "2nd";
  if (level === 3) return "3rd";
  return `${level}th`;
}

/**
 * Two-pane rest dialog. Left pane: short rest preview + execute, plus the
 * per-class Hit Dice spend-to-heal rows (spending HD is legal *during* a
 * short rest RAW, so the rows live here and keep the dialog open — the rest
 * itself remains a separate button press). Right pane: long rest preview +
 * execute, including the HD recovery preview (⌊total/2⌋ min 1, largest die
 * first). Rest buttons disable when the rest would have no visible effect.
 * Executing a rest closes the dialog.
 */
export function RestDialog({ open, onClose }: RestDialogProps) {
  const {
    shortRest,
    longRest,
    canShortRest,
    canLongRest,
    hitDicePools,
    spendHitDie,
    arcaneRecovery,
  } = useRest();
  const { maxHp } = useCharacter();
  const { state } = useCharacterState();
  const { resources } = useResources();
  const pactUsed = ((state.spell_slots_used as Record<string, number> | undefined)?.pact ?? 0) > 0;
  const shortRestResources = resources.filter((r) => r.recovery === "short");

  const currentHp = state.current_hp ?? maxHp;
  const tempHp = state.temp_hp ?? 0;
  const exhaustion = (state.exhaustion as number | undefined) ?? 0;
  const deathSaves = state.death_saves ?? { successes: 0, failures: 0 };

  const hpFull = currentHp >= maxHp;
  const hdRecovered = Object.values(
    computeLongRestHdRecovery(hitDicePools),
  ).reduce((sum, n) => sum + n, 0);

  // Arcane Recovery slot picks (slot level → count). Dialog-local: they only
  // become state when the short rest executes, folded into its atomic patch.
  // Picks reset on every open transition (render-phase state adjustment —
  // the dialog stays mounted between opens).
  const [recoveryPicks, setRecoveryPicks] = useState<ArcaneRecoveryPicks>({});
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRecoveryPicks({});
  }

  const pickedTotal = totalPickedLevels(recoveryPicks);
  const recoveryRemaining = arcaneRecovery.budget - pickedTotal;
  const recoveryLevels = Object.keys(arcaneRecovery.recoverableSlots)
    .map(Number)
    .sort((a, b) => a - b);

  const adjustPick = (level: number, delta: number) => {
    setRecoveryPicks((prev) => {
      const key = String(level);
      const spent = arcaneRecovery.recoverableSlots[key] ?? 0;
      const next = Math.min(spent, Math.max(0, (prev[key] ?? 0) + delta));
      const out = { ...prev };
      if (next === 0) delete out[key];
      else out[key] = next;
      return out;
    });
  };

  const onShortRest = () => {
    shortRest(recoveryPicks);
    onClose();
  };
  const onLongRest = () => {
    longRest();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rest</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Short Rest pane */}
          <section className="space-y-3 p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Moon className="size-4 text-muted-foreground" />
              <h3 className="font-semibold">Short Rest</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              {pactUsed && <li>Restore Warlock pact slots</li>}
              {shortRestResources.length > 0 && (
                <li>Reset {shortRestResources.map((r) => r.name).join(", ")}</li>
              )}
              {pickedTotal > 0 && (
                <li>
                  Recover {pickedTotal} spell slot{" "}
                  {pickedTotal === 1 ? "level" : "levels"} (Arcane Recovery)
                </li>
              )}
              {!pactUsed &&
                shortRestResources.length === 0 &&
                !arcaneRecovery.available && (
                  <li className="italic">No short-rest recovery available</li>
                )}
            </ul>

            {/* Arcane Recovery: slot-level picker (design §4.6, D8). Picks are
                applied WITH the short rest — one atomic patch restoring the
                chosen slots and spending the once-per-day feature use. */}
            {arcaneRecovery.available && (
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Arcane Recovery
                  </h4>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {pickedTotal}/{arcaneRecovery.budget} slot levels
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Once per day: recover spell slots with combined levels up to{" "}
                  {arcaneRecovery.budget} (none 6th level or higher). Applied
                  with the short rest.
                </p>
                {recoveryLevels.map((level) => {
                  const key = String(level);
                  const spent = arcaneRecovery.recoverableSlots[key] ?? 0;
                  const count = recoveryPicks[key] ?? 0;
                  const addDisabledReason =
                    count >= spent
                      ? "No more spent slots at this level"
                      : level > recoveryRemaining
                        ? "Not enough recovery budget remaining"
                        : undefined;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {ordinal(level)} level —{" "}
                        <span className="text-foreground font-medium">
                          {spent}
                        </span>{" "}
                        spent
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon-xs"
                          variant="outline"
                          aria-label={`Recover one fewer ${ordinal(level)}-level slot`}
                          disabled={count === 0}
                          onClick={() => adjustPick(level, -1)}
                        >
                          <Minus />
                        </Button>
                        <span
                          className="w-5 text-center text-sm font-medium tabular-nums"
                          aria-label={`${count} ${ordinal(level)}-level ${count === 1 ? "slot" : "slots"} selected`}
                        >
                          {count}
                        </span>
                        <Button
                          size="icon-xs"
                          variant="outline"
                          aria-label={`Recover one more ${ordinal(level)}-level slot`}
                          disabled={addDisabledReason !== undefined}
                          title={addDisabledReason}
                          onClick={() => adjustPick(level, +1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hit Dice: spend-to-heal rows. Repeatable until pools empty or
                HP full; each spend rolls 1dX+CON and applies one atomic patch. */}
            {hitDicePools.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Dices className="size-4 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hit Dice
                  </h4>
                  <span className="ml-auto text-xs text-muted-foreground">
                    HP {currentHp}/{maxHp}
                  </span>
                </div>
                {hitDicePools.map((pool) => {
                  const remaining = pool.max - pool.spent;
                  const disabledReason =
                    remaining === 0
                      ? "No hit dice remaining"
                      : hpFull
                        ? "HP is already full"
                        : undefined;
                  return (
                    <div
                      key={pool.classSlug}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {formatClassSlug(pool.classSlug)} d{pool.die} —{" "}
                        <span className="text-foreground font-medium">
                          {remaining}/{pool.max}
                        </span>{" "}
                        remaining
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={disabledReason !== undefined}
                        title={disabledReason}
                        onClick={() => void spendHitDie(pool.classSlug)}
                      >
                        Spend &amp; Roll
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              className="w-full"
              onClick={onShortRest}
              disabled={!canShortRest && pickedTotal === 0}
              title={
                !canShortRest && pickedTotal === 0
                  ? "No short-rest recovery available for this character"
                  : undefined
              }
            >
              Take Short Rest
            </Button>
          </section>

          {/* Long Rest pane */}
          <section className="space-y-3 p-4 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Sun className="size-4 text-muted-foreground" />
              <h3 className="font-semibold">Long Rest</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>HP {currentHp} → {maxHp}</li>
              {tempHp > 0 && <li>Clear {tempHp} temp HP</li>}
              {hdRecovered > 0 && (
                <li>
                  Recover {hdRecovered} hit {hdRecovered === 1 ? "die" : "dice"}
                </li>
              )}
              <li>Restore all spell slots</li>
              {resources.length > 0 && <li>Restore all feature uses</li>}
              {state.concentrating_on && (
                <li>Drop concentration on {(state.concentrating_on as ConcentrationState).spell_name ?? "current spell"}</li>
              )}
              {(deathSaves.successes > 0 || deathSaves.failures > 0) && (
                <li>Clear death saves</li>
              )}
              {exhaustion > 0 && <li>Exhaustion {exhaustion} → {exhaustion - 1}</li>}
            </ul>
            <Button
              className="w-full"
              onClick={onLongRest}
              disabled={!canLongRest}
              title={!canLongRest ? "Fully rested" : undefined}
            >
              Take Long Rest
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
