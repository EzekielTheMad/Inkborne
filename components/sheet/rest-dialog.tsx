"use client";

import { Moon, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRest, useCharacter, useCharacterState } from "@/lib/character/character-context";

interface RestDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Two-pane rest dialog. Left pane: short rest preview + execute. Right pane:
 * long rest preview + execute. Buttons disable when the rest would have no
 * visible effect. Executing a rest closes the dialog.
 */
export function RestDialog({ open, onClose }: RestDialogProps) {
  const { shortRest, longRest, canShortRest, canLongRest } = useRest();
  const { maxHp } = useCharacter();
  const { state } = useCharacterState();

  const currentHp = state.current_hp ?? maxHp;
  const tempHp = state.temp_hp ?? 0;
  const exhaustion = (state.exhaustion as number | undefined) ?? 0;
  const deathSaves = state.death_saves ?? { successes: 0, failures: 0 };

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
              <li>Restore Warlock pact slots</li>
              <li>Reset short-rest resources (Ki, Channel Divinity, etc.)</li>
            </ul>
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
              <li>Restore all spell slots</li>
              <li>Reset all feature resources</li>
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
