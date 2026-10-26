"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Effect } from "@/lib/types/effects";

export interface ContentEntry {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
  effects: Effect[];
  version: number;
  source: string;
  system_id?: string;
  scope?: string;
  owner_id?: string | null;
}

interface ContentBrowserProps {
  entries: ContentEntry[];
  contentTypeLabel: string;
  onSelect: (entry: ContentEntry) => void;
}

/** Discovery uses a dropdown; the existing preview still confirms the choice. */
export function ContentBrowser({ entries, contentTypeLabel, onSelect }: ContentBrowserProps) {
  const id = useId();
  const [search, setSearch] = useState("");
  const filtered = entries.filter(entry => entry.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="space-y-3">
    <Input aria-label={`Search ${contentTypeLabel}`} placeholder={`Search ${contentTypeLabel}…`}
      value={search} onChange={event => setSearch(event.target.value)} className="max-w-sm" />
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">Choose {contentTypeLabel}</label>
      <select id={id} value="" disabled={filtered.length === 0}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        onChange={event => {
          const entry = filtered.find(candidate => candidate.id === event.target.value);
          if (entry) onSelect(entry);
        }}>
        <option value="">Choose a {contentTypeLabel.toLowerCase()} to preview…</option>
        {filtered.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
    </div>
    {filtered.length === 0 && <p className="text-sm text-muted-foreground">No available {contentTypeLabel.toLowerCase()} options match.</p>}
  </div>;
}
