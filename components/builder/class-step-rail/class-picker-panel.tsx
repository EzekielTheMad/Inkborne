"use client";

import { Button } from "@/components/ui/button";
import { useId } from "react";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ClassPickerPanelProps {
  classes: ContentEntry[];
  mechanicsAvailable?: boolean;
  resolvedStats: Record<string, number>;
  selectedClasses: Array<{ slug: string }>;
  levelsRemaining: number;
  onSelect: (content: ContentEntry) => void;
  onCancel: () => void;
  chrome?: "default" | "embedded";
}

export function ClassPickerPanel({
  classes,
  resolvedStats,
  mechanicsAvailable = false,
  selectedClasses,
  levelsRemaining,
  onSelect,
  onCancel,
  chrome = "default",
}: ClassPickerPanelProps) {
  const prereqs = multiclassPrereqsForAll(resolvedStats, selectedClasses, classes, mechanicsAvailable);
  const id = useId();
  const available = levelsRemaining > 0 ? classes.filter((_, index) => prereqs[index]?.state === "met") : [];

  return (
    <section
      aria-labelledby={chrome === "default" ? "class-picker-heading" : undefined}
      className="space-y-4"
    >
      {chrome === "default" && (
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="class-picker-heading" className="text-xl font-semibold">
              Add a class
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {levelsRemaining} levels remaining · pick a class with met prerequisites
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel} autoFocus>
            Cancel
          </Button>
        </header>
      )}
      {chrome === "embedded" && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} autoFocus>
            Cancel
          </Button>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium">Choose an additional class</label>
        <select id={id} value="" disabled={available.length === 0}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          onChange={event => {
            const entry = available.find(candidate => candidate.id === event.target.value);
            if (entry) onSelect(entry);
          }}>
          <option value="">Choose a class to preview…</option>
          {available.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </div>
      {available.length === 0 && <p className="text-sm text-muted-foreground">No additional classes are available with your current saved ability scores and remaining levels.</p>}
    </section>
  );
}
