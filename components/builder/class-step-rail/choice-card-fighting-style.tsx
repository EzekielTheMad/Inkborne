"use client";

import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface ChoiceCardFightingStyleProps {
  featureSlug: string;
  classSlug: string;
  styleOptions: ContentEntry[];
  currentStyleSlug: string | undefined;
  onSelect: (featureSlug: string, classSlug: string, styleSlug: string | undefined) => void;
}

export function ChoiceCardFightingStyle({
  featureSlug,
  classSlug,
  styleOptions,
  currentStyleSlug,
  onSelect,
}: ChoiceCardFightingStyleProps) {
  const isMade = styleOptions.some(style => style.slug === currentStyleSlug);
  const selected = styleOptions.find(style => style.slug === currentStyleSlug);
  const description = typeof selected?.data.description === "string" ? selected.data.description : null;

  return (
    <article className="rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">Fighting Style</h4>
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

      {styleOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fighting styles available.</p>
      ) : (
        <label className="block text-sm">Fighting style
          <select value={selected?.slug ?? ""}
            onChange={event => { const next = styleOptions.find(style => style.slug === event.target.value);
              if (next && next.slug !== currentStyleSlug) onSelect(featureSlug, classSlug, next.slug); }}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Choose a fighting style</option>
            {styleOptions.map(style => <option key={style.id} value={style.slug}>{style.name.replace(/^Fighting Style:\s*/, "")}</option>)}
          </select>
        </label>
      )}
      {description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {currentStyleSlug && !selected && <p role="alert" className="mt-3 text-sm text-destructive">
        Saved fighting style “{currentStyleSlug}” is unavailable. It remains saved until you choose a replacement.
      </p>}
    </article>
  );
}
