import { useId } from "react";
import type { ContentEntry } from "@/components/builder/content-browser";

interface SubclassesTabProps {
  classContent: ContentEntry;
  subclasses: ContentEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function SubclassesTab({ classContent, subclasses, selectedSlug, onSelect }: SubclassesTabProps) {
  const id = useId();
  const matching = subclasses.filter(entry => entry.data.parent_class === classContent.slug);
  const selected = matching.find(entry => entry.slug === selectedSlug);
  if (!matching.length) return <p className="text-sm text-muted-foreground">No subclasses found.</p>;
  return <div className="space-y-3">
    <label htmlFor={id} className="text-sm font-medium">Preview subclass</label>
    <select id={id} value={selected?.slug ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      onChange={event => {
        const value = event.target.value;
        if (value === "" || matching.some(entry => entry.slug === value)) onSelect(value || null);
      }}>
      <option value="">Choose a subclass to preview…</option>
      {matching.map(entry => <option key={entry.id} value={entry.slug}>{entry.name}</option>)}
    </select>
    {selected && <div className="rounded-md border border-border bg-card/40 p-3">
      <p className="text-sm font-medium">{selected.name}</p>
      {typeof selected.data.description === "string" && <p className="mt-1 text-sm text-muted-foreground">{selected.data.description}</p>}
    </div>}
  </div>;
}
