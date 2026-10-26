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
  const selected = matching.find(subclass => subclass.slug === currentSelection);
  const isMade = !!selected;
  const description = typeof selected?.data.description === "string" ? selected.data.description : null;

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
        <label className="block text-sm">{label}
          <select value={selected?.slug ?? ""}
            onChange={event => { const next = matching.find(item => item.slug === event.target.value);
              if (next && next.slug !== currentSelection) onSelect(next.slug); }}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Choose a subclass</option>
            {matching.map(subclass => <option key={subclass.id} value={subclass.slug}>{subclass.name}</option>)}
          </select>
        </label>
      )}
      {description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {currentSelection && !selected && <p role="alert" className="mt-3 text-sm text-destructive">
        Saved subclass “{currentSelection}” is unavailable for this class. It remains saved until you choose a replacement or clear it.
      </p>}
      {currentSelection && <div className="mt-3 space-y-1">
        <button type="button" onClick={() => onSelect(undefined)}
          className="rounded-md px-2 py-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Clear subclass
        </button>
        <p className="text-xs text-muted-foreground">Clearing this choice also removes its subclass features and spell choices.</p>
      </div>}
    </article>
  );
}
