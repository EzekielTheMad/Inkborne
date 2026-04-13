"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Effect } from "@/lib/types/effects";

const ABILITY_ABBR = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

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
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    {entry.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {entry.source === "srd" ? "SRD" : "Homebrew"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {/* Description */}
                {typeof entry.data.description === "string" && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {entry.data.description}
                  </p>
                )}

                {/* Class-specific: hit die, primary ability */}
                {entry.content_type === "class" && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {entry.data.hit_die != null && (
                      <Badge variant="secondary" className="text-[10px]">
                        d{String(entry.data.hit_die)}
                      </Badge>
                    )}
                    {typeof entry.data.primaryAbility === "string" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.data.primaryAbility}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Race-specific: ability scores, speed, vision */}
                {entry.content_type === "race" && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Array.isArray(entry.data.scores) && (
                      <Badge variant="secondary" className="text-[10px]">
                        {(entry.data.scores as number[])
                          .map((v, i) => (v !== 0 ? `${v > 0 ? "+" : ""}${v} ${ABILITY_ABBR[i]}` : null))
                          .filter(Boolean)
                          .join(", ")}
                      </Badge>
                    )}
                    {entry.data.speed_detail != null
                      ? Object.entries(entry.data.speed_detail as Record<string, number>)
                          .filter(([key]) => key !== "encumbered")
                          .map(([type, spd]) => (
                            <Badge key={type} variant="secondary" className="text-[10px]">
                              {type === "walk" ? `${spd} ft` : `${type} ${spd} ft`}
                            </Badge>
                          ))
                      : entry.data.speed != null && (
                          <Badge variant="secondary" className="text-[10px]">
                            {String(entry.data.speed)} ft
                          </Badge>
                        )}
                    {Array.isArray(entry.data.vision) &&
                      (entry.data.vision as Array<{ type: string; range: number }>).map((v, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] capitalize">
                          {v.type} {v.range} ft
                        </Badge>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
