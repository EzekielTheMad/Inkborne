"use client";

import { cn } from "@/lib/utils";
import type { CharacterState, CharacterDeathSaves } from "@/lib/types/character";

interface DeathSavesProps {
  currentHp: number;
  deathSaves: CharacterDeathSaves;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
}

export function DeathSaves({ currentHp, deathSaves, patchState }: DeathSavesProps) {
  // Only render when HP is 0
  if (currentHp > 0) return null;

  const { successes, failures } = deathSaves;

  function handleSuccessClick() {
    const newSuccesses = successes >= 3 ? 0 : successes + 1;
    patchState({
      death_saves: { successes: newSuccesses, failures },
    });
  }

  function handleFailureClick() {
    const newFailures = failures >= 3 ? 0 : failures + 1;
    patchState({
      death_saves: { successes, failures: newFailures },
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

      {isStabilized && (
        <p className="text-xs text-green-500 font-medium">Stabilized</p>
      )}
      {isDead && !isStabilized && (
        <p className="text-xs text-destructive font-medium">Dead</p>
      )}
    </div>
  );
}
