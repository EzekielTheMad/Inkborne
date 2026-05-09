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
  const isMade = !!currentStyleSlug;

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
        <div className="grid gap-2 sm:grid-cols-2">
          {styleOptions.map((style) => {
            const data = style.data as Record<string, unknown>;
            const description = typeof data.description === "string" ? data.description : null;
            const displayName = style.name.replace(/^Fighting Style:\s*/, "");
            const selected = currentStyleSlug === style.slug;
            return (
              <button
                key={style.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(featureSlug, classSlug, style.slug)}
                className={cn(
                  "text-left rounded-md border bg-card/30 px-3 py-3 transition-colors",
                  "border-border hover:border-accent/50",
                  selected && "border-accent bg-accent/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <p className="text-sm font-medium">{displayName}</p>
                {description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">{description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
