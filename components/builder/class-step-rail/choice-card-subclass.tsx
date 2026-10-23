"use client";

import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ChoiceCardSubclassProps {
  classSlug: string;
  subclasses: ContentEntry[];
  currentSelection: string | undefined;
  onSelect: (slug: string | undefined) => void;
  /** Optional override label (defaults to "Subclass"). */
  label?: string;
}

export function ChoiceCardSubclass({
  classSlug,
  subclasses,
  currentSelection,
  onSelect,
  label = "Subclass",
}: ChoiceCardSubclassProps) {
  const matching = subclasses.filter(
    (sc) => (sc.data as Record<string, unknown>).parent_class === classSlug,
  );
  const isMade = !!currentSelection;

  return (
    <article className="rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">{label}</h4>
        <span
          aria-label={isMade ? "Choice made" : "Choice not yet made"}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
            isMade ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive",
          )}
        >
          {isMade ? "Chosen" : "Choose"}
        </span>
      </header>

      {matching.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subclasses available for this class.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {matching.map((sc) => {
            const data = sc.data as Record<string, unknown>;
            const description = typeof data.description === "string" ? data.description : null;
            const selected = currentSelection === sc.slug;
            return (
              <button
                key={sc.id}
                type="button"
                aria-pressed={selected}
                onClick={() => { if (!selected) onSelect(sc.slug); }}
                className={cn(
                  "text-left rounded-md border bg-card/30 px-3 py-3 transition-colors",
                  "border-border hover:border-accent/50",
                  selected && "border-accent bg-accent/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <p className="text-sm font-medium">{sc.name}</p>
                {description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">{description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
      {isMade && <div className="mt-3 space-y-1">
        <button type="button" onClick={() => onSelect(undefined)}
          className="rounded-md px-2 py-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Clear subclass
        </button>
        <p className="text-xs text-muted-foreground">Clearing this choice also removes its subclass features and spell choices.</p>
      </div>}
    </article>
  );
}
