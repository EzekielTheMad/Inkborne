import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface SubclassesTabProps {
  classContent: ContentEntry;
  subclasses: ContentEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function SubclassesTab({
  classContent,
  subclasses,
  selectedSlug,
  onSelect,
}: SubclassesTabProps) {
  // Defensive filter — parent should have already filtered by class, but in
  // case it didn't.
  const matching = subclasses.filter(
    (sc) => (sc.data as Record<string, unknown>).class === classContent.slug,
  );

  if (matching.length === 0) {
    return <p className="text-sm text-muted-foreground">No subclasses found.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {matching.map((sc) => {
        const data = sc.data as Record<string, unknown>;
        const description = typeof data.description === "string" ? data.description : null;
        const isSelected = selectedSlug === sc.slug;
        return (
          <button
            key={sc.id}
            type="button"
            aria-pressed={isSelected}
            // `|| undefined` so React omits the attribute entirely when
            // false; Tailwind's data-[selected=true] selector applies only
            // when the attribute is present with value "true".
            data-selected={isSelected || undefined}
            onClick={() => onSelect(isSelected ? null : sc.slug)}
            className={cn(
              "text-left rounded-md border bg-card/40 px-3 py-3 transition-colors",
              "border-border hover:border-accent/50",
              "data-[selected=true]:border-accent data-[selected=true]:bg-accent/10",
            )}
          >
            <p className="text-sm font-medium">{sc.name}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                {description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
