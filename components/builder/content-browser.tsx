"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
}

interface ContentBrowserProps {
  entries: ContentEntry[];
  contentTypeLabel: string;
  onSelect: (entry: ContentEntry) => void;
}

export function ContentBrowser({
  entries,
  contentTypeLabel,
  onSelect,
}: ContentBrowserProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const lower = search.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(lower));
  }, [entries, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder={`Search ${contentTypeLabel}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length} {contentTypeLabel.toLowerCase()}
          {filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">
          No {contentTypeLabel.toLowerCase()}s found.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Card
              key={entry.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelect(entry)}
            >
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium">
                  {entry.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground capitalize">
                  {entry.source === "srd" ? "SRD" : "Homebrew"}
                </p>
                {typeof entry.data.description === "string" && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {entry.data.description.slice(0, 120)}
                    {entry.data.description.length > 120 ? "..." : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
