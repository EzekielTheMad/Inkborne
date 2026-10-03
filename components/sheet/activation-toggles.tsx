"use client";

import { useState } from "react";
import { useDialogAction } from "@/lib/character/use-dialog-action";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { Button } from "@/components/ui/button";

interface ActivationToggle {
  key: string;
  label: string;
  active: boolean;
}

interface ActivationTogglesProps {
  toggles: ActivationToggle[];
  onToggle: (key: string, active: boolean) => Promise<boolean | void> | void;
}

export function ActivationToggles({
  toggles,
  onToggle,
}: ActivationTogglesProps) {
  const { pending, run } = useDialogAction();
  const [saveError, setSaveError] = useState<string | null>(null);
  const change = (key: string, active: boolean) => {
    setSaveError(null);
    void run(async () => onToggle(key, active), saved => {
      if (saved === false) setSaveError("This toggle could not be saved. Please try again.");
    }, error => setSaveError(error instanceof CharacterStateReloadError
      ? error.message : "This toggle could not be saved. Wait for any pending save, then try again."));
  };
  if (toggles.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Active Effects</p>
      <div className="flex flex-wrap gap-2">
        {toggles.map((toggle) => (
          <Button
            key={toggle.key}
            variant={toggle.active ? "default" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => change(toggle.key, !toggle.active)}
            className={
              toggle.active
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : ""
            }
          >
            {toggle.label}
            {toggle.active && " (Active)"}
          </Button>
        ))}
      </div>
      {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}
    </div>
  );
}
