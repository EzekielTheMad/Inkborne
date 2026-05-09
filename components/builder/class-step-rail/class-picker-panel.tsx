"use client";

import { Button } from "@/components/ui/button";
import { ClassPickerCard } from "@/components/builder/class-step-rail/class-picker-card";
import { multiclassPrereqsForAll } from "@/lib/builder/multiclass-prereqs";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ClassPickerPanelProps {
  classes: ContentEntry[];
  resolvedStats: Record<string, number>;
  selectedClasses: Array<{ slug: string }>;
  levelsRemaining: number;
  onSelect: (content: ContentEntry) => void;
  onCancel: () => void;
}

export function ClassPickerPanel({
  classes,
  resolvedStats,
  selectedClasses,
  levelsRemaining,
  onSelect,
  onCancel,
}: ClassPickerPanelProps) {
  const prereqs = multiclassPrereqsForAll(resolvedStats, selectedClasses, classes);

  return (
    <section
      aria-labelledby="class-picker-heading"
      className="space-y-4"
    >
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c, i) => (
          <ClassPickerCard
            key={c.slug}
            classContent={c}
            prereq={prereqs[i]}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
