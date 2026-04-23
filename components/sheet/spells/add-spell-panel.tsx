"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchSpells, type SearchSpellsOptions } from "@/lib/supabase/spells";
import { useSpells } from "@/lib/character/character-context";

interface SpellSearchResult {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
}

interface AddSpellPanelProps {
  open: boolean;
  onClose: () => void;
  systemId: string;
}

const LEVEL_PILLS: Array<{ key: string; label: string; level: number }> = [
  { key: "cantrip", label: "Cantrip", level: 0 },
  { key: "1", label: "1st", level: 1 },
  { key: "2", label: "2nd", level: 2 },
  { key: "3", label: "3rd", level: 3 },
  { key: "4", label: "4th", level: 4 },
  { key: "5", label: "5th", level: 5 },
  { key: "6", label: "6th", level: 6 },
  { key: "7", label: "7th", level: 7 },
  { key: "8", label: "8th", level: 8 },
  { key: "9", label: "9th", level: 9 },
];

export function AddSpellPanel({ open, onClose, systemId }: AddSpellPanelProps) {
  const { casterInfo, addSpell, spells } = useSpells();
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(
    casterInfo.classes[0]?.slug ?? null,
  );
  const [results, setResults] = useState<SpellSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    const opts: SearchSpellsOptions = {};
    if (selectedClass) opts.classSlug = selectedClass;
    if (selectedLevel != null) opts.level = selectedLevel;
    const data = await searchSpells(systemId, query, opts);
    setResults(data);
    setLoading(false);
  }, [systemId, query, selectedClass, selectedLevel]);

  useEffect(() => {
    if (!open) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(runSearch, 200);
  }, [runSearch, open]);

  if (!open) return null;

  const selectedCaster = casterInfo.classes.find((c) => c.slug === selectedClass);

  const handleAdd = async (spell: SpellSearchResult, intent: "known" | "spellbook" | "available") => {
    if (!selectedClass) return;
    const level = (spell.data?.level as number | undefined) ?? 0;
    // Enforce cantrip cap: count existing cantrips known, block if at cap.
    // Spellbook intent (wizard) and available intent (prepared casters) don't get enforced for
    // non-cantrip levels in Phase 1 — spells known caps for known casters can be added later.
    if (level === 0 && intent === "known" && selectedCaster) {
      const existingCantrips = spells.filter(
        (s) =>
          s.class_slug === selectedClass &&
          ((s.content_definitions?.data?.level as number | undefined) ?? 0) === 0,
      ).length;
      if (existingCantrips >= selectedCaster.cantripsKnown) {
        alert(
          `You already know the maximum number of cantrips (${selectedCaster.cantripsKnown}) for ${selectedClass}.`,
        );
        return;
      }
    }
    await addSpell({
      content_id: spell.id,
      name: spell.name,
      class_slug: selectedClass,
      is_known: intent === "known",
      is_prepared: false,
      in_spellbook: intent === "spellbook",
    });
    setExpandedId(null);
  };

  return (
    <div className="rounded-lg border border-border bg-background space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Add spell</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {casterInfo.classes.length > 1 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Class</p>
          <div className="flex flex-wrap gap-1">
            {casterInfo.classes.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setSelectedClass(c.slug)}
                className={cn(
                  "text-xs px-2 py-1 rounded-full border capitalize",
                  selectedClass === c.slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
                )}
              >
                {c.slug}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search spells…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {LEVEL_PILLS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setSelectedLevel(selectedLevel === p.level ? null : p.level)}
            className={cn(
              "text-xs px-2 py-1 rounded-full border",
              selectedLevel === p.level
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-4">Searching…</p>
        )}
        {!loading && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No spells found. Try adjusting filters.
          </p>
        )}
        {results.map((spell) => {
          const isExpanded = expandedId === spell.id;
          const level = (spell.data?.level as number | undefined) ?? 0;
          const school = (spell.data?.school as string | undefined) ?? "";
          const ritual = !!spell.data?.ritual;
          const concentration = !!spell.data?.concentration;
          return (
            <div key={spell.id} className="rounded border border-border/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : spell.id)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-accent/30"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{spell.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {level === 0 ? "Cantrip" : `L${level}`} · {school}
                  </span>
                  {ritual && <span className="text-[9px] text-muted-foreground">R</span>}
                  {concentration && <span className="text-[9px] text-muted-foreground">C</span>}
                </span>
              </button>
              {isExpanded && (
                <div className="p-2 border-t border-border/50 space-y-2">
                  {spell.data?.description ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {String(spell.data.description)}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    {selectedCaster?.slug === "wizard" && level > 0 ? (
                      <Button size="sm" onClick={() => handleAdd(spell, "spellbook")}>
                        Add to Spellbook
                      </Button>
                    ) : selectedCaster?.prepared && level > 0 ? (
                      <Button size="sm" onClick={() => handleAdd(spell, "available")}>
                        Add (available to prepare)
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleAdd(spell, "known")}>
                        {level === 0 ? "Learn Cantrip" : "Learn Spell"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
