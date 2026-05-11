"use client";

import { Button } from "@/components/ui/button";

interface LevelUpActionBarProps {
  classLabel: string;
  draftLevel: number;
  totalLevelAfterConfirm: number;
  canConfirm: boolean;
  /** Human-readable text describing what's missing when canConfirm is false. Ignored when canConfirm is true. */
  missingReason: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LevelUpActionBar(props: LevelUpActionBarProps) {
  const { classLabel, draftLevel, totalLevelAfterConfirm, canConfirm, missingReason, onCancel, onConfirm } = props;
  const reasonId = `level-up-confirm-reason-${classLabel.toLowerCase()}-${draftLevel}`;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <Button variant="outline" size="sm" onClick={onCancel}>
        Cancel level-up
      </Button>
      <p className="text-xs text-muted-foreground">
        Will set {classLabel} to Lv {draftLevel} · character to Lv {totalLevelAfterConfirm}
      </p>
      <Button
        variant="default"
        onClick={onConfirm}
        disabled={!canConfirm}
        aria-describedby={canConfirm ? undefined : reasonId}
        className="ml-auto bg-character-fg text-background hover:opacity-90"
      >
        Confirm level {draftLevel}
      </Button>
      {!canConfirm && (
        <span id={reasonId} className="sr-only">
          {missingReason}
        </span>
      )}
    </div>
  );
}
