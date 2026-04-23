"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Plus, Check, Trash2 } from "lucide-react";
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

/**
 * The highest spell level this character can actually cast.
 * Derived from maxSlots — returns the highest key with slots > 0.
 * Warlocks get their pact slot level. Non-casters get 0.
 * Cantrips (level 0) are always castable by casters who know them.
 */
function getMaxCastableLevel(
  maxSlots: Record<string, number | undefined>,
  casterClasses: Array<{ slug: string; level: number }>,
): number {
  // Full/half casters: highest slot key with count > 0
  let maxLevel = 0;
  for (let i = 9; i >= 1; i--) {
    if ((maxSlots[String(i)] ?? 0) > 0) {
      maxLevel = i;
      break;
    }
  }
  // Warlock pact slots: determine pact slot level from class level
  // (Warlock L1-2 = 1st, L3-4 = 2nd, L5-6 = 3rd, L7-8 = 4th, L9+ = 5th)
  const warlock = casterClasses.find((c) => c.slug === "warlock");
  if (warlock && (maxSlots.pact ?? 0) > 0) {
    const pactLevel = warlock.level >= 9 ? 5 : Math.min(5, Math.ceil(warlock.level / 2));
    if (pactLevel > maxLevel) maxLevel = pactLevel;
  }
  return maxLevel;
}

export function AddSpellPanel({ open, onClose, systemId }: AddSpellPanelProps) {
  const { casterInfo, maxSlots, addSpell, removeSpell, spells } = useSpells();
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(
    casterInfo.classes[0]?.slug ?? null,
  );
  const [results, setResults] = useState<SpellSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCaster = casterInfo.classes.find((c) => c.slug === selectedClass);
  const maxCastableLevel = useMemo(
    () => getMaxCastableLevel(maxSlots as Record<string, number | undefined>, casterInfo.classes),
    [maxSlots, casterInfo.classes],
  );

  // Count cantrips already known for the selected class (for cap enforcement).
  const cantripsKnown = useMemo(() => {
    return spells.filter(
      (s) =>
        s.class_slug === selectedClass &&
        ((s.content_definitions?.data?.level as number | undefined) ?? 0) === 0,
    ).length;
  }, [spells, selectedClass]);

  const cantripsAtCap =
    !!selectedCaster && cantripsKnown >= selectedCaster.cantripsKnown;

  // Map from content_id → spell row id for the current class (so we can remove by id).
  const existingByContentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of spells) {
      if (s.class_slug === selectedClass && s.content_id) {
        map.set(s.content_id, s.id);
      }
    }
    return map;
  }, [spells, selectedClass]);

  const runSearch = useCallback(async () => {
    setLoading(true);
    const opts: SearchSpellsOptions = {};
    if (selectedClass) opts.classSlug = selectedClass;
    if (selectedLevel != null) opts.level = selectedLevel;
    const data = await searchSpells(systemId, query, opts);
    // Client-side filter: exclude spell levels above what this character can cast.
    // Cantrips (level 0) are always available to casters.
    const filtered = data.filter((spell) => {
      const level = (spell.data?.level as number | undefined) ?? 0;
      if (level === 0) return true;
      return level <= maxCastableLevel;
    });
    setResults(filtered);
    setLoading(false);
  }, [systemId, query, selectedClass, selectedLevel, maxCastableLevel]);

  useEffect(() => {
    if (!open) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(runSearch, 200);
  }, [runSearch, open]);

  if (!open) return null;

  const handleAdd = async (spell: SpellSearchResult) => {
    if (!selectedClass || !selectedCaster) return;
    const level = (spell.data?.level as number | undefined) ?? 0;

    // Cantrip cap — shouldn't reach here because the button is disabled when at cap,
    // but guard against concurrent state changes.
    if (level === 0 && cantripsAtCap) return;

    // Determine add intent based on class type
    const intent: "known" | "spellbook" | "available" =
      selectedCaster.slug === "wizard" && level > 0
        ? "spellbook"
        : selectedCaster.prepared && level > 0
          ? "available"
          : "known";

    setBusyId(spell.id);
    try {
      await addSpell({
        content_id: spell.id,
        name: spell.name,
        class_slug: selectedClass,
        is_known: intent === "known",
        is_prepared: false,
        in_spellbook: intent === "spellbook",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (spellRowId: string, spellId: string) => {
    setBusyId(spellId);
    try {
      await removeSpell(spellRowId);
    } finally {
      setBusyId(null);
    }
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
        {LEVEL_PILLS.map((p) => {
          const disabled = p.level > 0 && p.level > maxCastableLevel;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                if (disabled) return;
                setSelectedLevel(selectedLevel === p.level ? null : p.level);
              }}
              disabled={disabled}
              className={cn(
                "text-xs px-2 py-1 rounded-full border",
                selectedLevel === p.level
                  ? "bg-primary text-primary-foreground border-primary"
                  : disabled
                    ? "bg-muted/20 text-muted-foreground/40 border-border/40 cursor-not-allowed line-through"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
              )}
              title={disabled ? "You don't have slots for this level yet" : undefined}
            >
              {p.label}
            </button>
          );
        })}
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
          const level = (spell.data?.level as number | undefined) ?? 0;
          const school = (spell.data?.school as string | undefined) ?? "";
          const ritual = !!spell.data?.ritual;
          const concentration = !!spell.data?.concentration;
          const existingRowId = existingByContentId.get(spell.id);
          const isAlreadyAdded = !!existingRowId;
          const isBusy = busyId === spell.id;
          const isCantripAtCap = level === 0 && cantripsAtCap && !isAlreadyAdded;

          return (
            <div
              key={spell.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-border/50 hover:bg-accent/20"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{spell.name}</span>
                  {ritual && <span className="text-[9px] text-muted-foreground">R</span>}
                  {concentration && <span className="text-[9px] text-muted-foreground">C</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {level === 0 ? "Cantrip" : `Level ${level}`}
                  {school && ` · ${school}`}
                </p>
              </div>
              {isAlreadyAdded ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(existingRowId, spell.id)}
                  disabled={isBusy}
                  className="shrink-0 h-7 text-muted-foreground hover:text-destructive group"
                  title="Remove spell"
                >
                  <Check className="size-3.5 mr-1 group-hover:hidden" />
                  <Trash2 className="size-3.5 mr-1 hidden group-hover:inline" />
                  <span className="group-hover:hidden">Added</span>
                  <span className="hidden group-hover:inline">Remove</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(spell)}
                  disabled={isBusy || isCantripAtCap}
                  className="shrink-0 h-7"
                  title={
                    isCantripAtCap
                      ? `Cantrip cap reached (${selectedCaster?.cantripsKnown ?? 0}). Remove another cantrip first.`
                      : undefined
                  }
                >
                  <Plus className={cn("size-3.5 mr-1", isBusy && "animate-pulse")} />
                  {isBusy ? "Adding…" : isCantripAtCap ? "Max" : "Add"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
