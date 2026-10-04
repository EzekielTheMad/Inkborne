"use client";

import { useState } from "react";
import { useDialogAction } from "@/lib/character/use-dialog-action";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { cn } from "@/lib/utils";
import { RollPopover } from "@/components/sheet/rolls/roll-popover";
import { resolveDeathSave } from "@/lib/rolls/death-saves";
import { useCharacterState, useRolls } from "@/lib/character/character-context";
import type { RollRequest } from "@/lib/dice/types";
import type { CharacterState, CharacterDeathSaves } from "@/lib/types/character";

interface DeathSavesProps {
  currentHp: number;
  deathSaves: CharacterDeathSaves;
  manualPatchState?: (patch: Partial<CharacterState>) => Promise<boolean | void>;
  patchState: (patch: Partial<CharacterState>) => Promise<boolean | void>;
}

export function DeathSaves({ currentHp, deathSaves, patchState, manualPatchState }: DeathSavesProps) {
  const { pending, run } = useDialogAction();
  const { state, reloadRequired, patchState: stateWriter } = useCharacterState();
  const { rollWithPersistence, rollPersistencePending, rollPersistenceUncertain } = useRolls();
  const [rollRecoveryRequired, setRollRecoveryRequired] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveManual = (patch: Partial<CharacterState>) => {
    setSaveError(null);
    void run(() => (manualPatchState ?? patchState)(patch), (saved) => {
      if (saved === false) setSaveError("These death-save marks could not be saved. Please try again.");
    }, error => setSaveError(error instanceof CharacterStateReloadError
      ? error.message : "These death-save marks could not be saved. Wait for any pending save, then try again."));
  };
  // Only render when HP is 0
  if (currentHp > 0) return null;

  const { successes, failures } = deathSaves;

  function handleSuccessClick() {
    const newSuccesses = successes >= 3 ? 0 : successes + 1;
    saveManual({
      death_saves: { successes: newSuccesses, failures },
    });
  }

  function handleFailureClick() {
    const newFailures = failures >= 3 ? 0 : failures + 1;
    saveManual({
      death_saves: { successes, failures: newFailures },
    });
  }

  // Established RAW resolution stays one conditional state patch. The roll
  // record is a separate write; either uncertain result requires review/reload.
  function handleRollRequest(request: RollRequest) {
    if (rollRecoveryRequired) return;
    setSaveError(null);
    let rolled = false;
    let rollSave: Promise<boolean> | undefined;
    void run(async () => {
      await stateWriter.runAction(state, confirmed => {
        const counts = confirmed.death_saves ?? { successes: 0, failures: 0 };
        if ((confirmed.current_hp ?? currentHp) > 0 || counts.successes >= 3 || counts.failures >= 3) {
          throw new Error("This character is no longer waiting for a death save.");
        }
        const tracked = rollWithPersistence(request);
        rolled = true;
        // Handle insertion rejection immediately, even if state settles first.
        rollSave = tracked.persistence.then(() => true, () => false);
        return { patch: resolveDeathSave(counts, tracked.result).patch, result: true };
      }, { requireCurrent: true });
      if (rollSave && !(await rollSave)) {
        throw new CharacterStateReloadError("The death-save marks were saved, but the roll record could not be confirmed. Reload and review the roll log before rolling again.");
      }
    }, () => {}, error => {
      if (rolled || error instanceof CharacterStateReloadError) setRollRecoveryRequired(true);
      setSaveError(error instanceof CharacterStateReloadError
        ? `${error.message} Roll recording and character state are separate saves; review both before rolling again.`
        : rolled ? "The death-save result could not be confirmed. Roll recording and character state are separate saves. Reload and review both before rolling again."
          : "The character is still saving or has changed. Wait for pending saves, then choose the action again.");
    });
  }

  const isStabilized = successes >= 3;
  const isDead = failures >= 3;

  return (
    <div className="rounded-lg border border-destructive/30 bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Death Saves
      </h3>

      <div className="space-y-2">
        {/* Successes row */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20">Successes</span>
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <button
                key={i}
                type="button"
                disabled={pending}
                onClick={handleSuccessClick}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-colors",
                  i < successes
                    ? "bg-green-500 border-green-500"
                    : "border-green-500/50 bg-transparent hover:border-green-500",
                )}
                aria-label={`Success ${i + 1}${i < successes ? " (filled)" : " (empty)"}`}
              />
            ))}
          </div>
        </div>

        {/* Failures row */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20">Failures</span>
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <button
                key={i}
                type="button"
                disabled={pending}
                onClick={handleFailureClick}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-colors",
                  i < failures
                    ? "bg-destructive border-destructive"
                    : "border-destructive/50 bg-transparent hover:border-destructive",
                )}
                aria-label={`Failure ${i + 1}${i < failures ? " (filled)" : " (empty)"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}
      {/* RAW roll — pips above stay for manual DM adjudication. Rolling stops
          once the character is stabilized or dead. */}
      {!isStabilized && !isDead && (
        <RollPopover
          kind="death_save"
          label="Death Save"
          ariaLabel="Roll death save"
          onRollRequest={handleRollRequest}
          disabled={pending || rollRecoveryRequired || rollPersistencePending || rollPersistenceUncertain || reloadRequired}
          className="w-full rounded-md border border-destructive/40 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-destructive hover:bg-destructive/10"
        >
          Roll Death Save
        </RollPopover>
      )}

      {isStabilized && (
        <p className="text-xs text-green-500 font-medium">Stabilized</p>
      )}
      {isDead && !isStabilized && (
        <p className="text-xs text-destructive font-medium">Dead</p>
      )}
    </div>
  );
}
