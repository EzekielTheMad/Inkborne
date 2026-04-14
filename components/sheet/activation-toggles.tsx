"use client";

import { Button } from "@/components/ui/button";

interface ActivationToggle {
  key: string;
  label: string;
  active: boolean;
}

interface ActivationTogglesProps {
  toggles: ActivationToggle[];
  onToggle: (key: string, active: boolean) => void;
}

export function ActivationToggles({
  toggles,
  onToggle,
}: ActivationTogglesProps) {
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
            onClick={() => onToggle(toggle.key, !toggle.active)}
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
    </div>
  );
}
