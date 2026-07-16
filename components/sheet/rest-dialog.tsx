"use client";

import { Dices, Moon, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRest, useCharacter, useCharacterState, useResources } from "@/lib/character/character-context";
import { computeLongRestHdRecovery, formatClassSlug } from "@/lib/hit-dice/helpers";
import type { ConcentrationState } from "@/lib/types/spells";

interface RestDialogProps {
  open: boolean;
  onClose: () => void;
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
  const { shortRest, longRest, canShortRest, canLongRest, hitDicePools, spendHitDie } = useRest();
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

  const onShortRest = () => {
    shortRest();
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
              {!pactUsed && shortRestResources.length === 0 && (
                <li className="italic">No short-rest recovery available</li>
              )}
            </ul>

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
              disabled={!canShortRest}
              title={
                !canShortRest
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
