import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ContentEntry } from "@/components/builder/content-browser";

interface SpellsTabProps {
  classContent: ContentEntry;
  spells: ContentEntry[];
}

const SCHOOLS = [
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
] as const;

export function SpellsTab({ classContent, spells }: SpellsTabProps) {
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [schoolFilter, setSchoolFilter] = useState<string | "all">("all");

  // Spells are eligible for this class if the spell's `data.classes` array
  // includes the class slug. Tolerant if the array is missing.
  const eligible = useMemo(
    () =>
      spells.filter((spell) => {
        const classes = (spell.data as Record<string, unknown>).classes as string[] | undefined;
        return Array.isArray(classes) && classes.includes(classContent.slug);
      }),
    [spells, classContent.slug],
  );

  const filtered = useMemo(
    () =>
      eligible.filter((spell) => {
        const data = spell.data as Record<string, unknown>;
        const level = data.level as number | undefined;
        const school = (data.school as string | undefined)?.toLowerCase();
        if (levelFilter !== "all" && level !== levelFilter) return false;
        if (schoolFilter !== "all" && school !== schoolFilter) return false;
        return true;
      }),
    [eligible, levelFilter, schoolFilter],
  );

  const levels = Array.from(new Set(eligible.map((s) => (s.data as Record<string, unknown>).level as number | undefined)))
    .filter((l): l is number => typeof l === "number")
    .sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={levelFilter === "all"}
          onClick={() => setLevelFilter("all")}
        >
          Level: all
        </FilterChip>
        {levels.map((lvl) => (
          <FilterChip
            key={lvl}
            active={levelFilter === lvl}
            onClick={() => setLevelFilter(lvl)}
          >
            {lvl === 0 ? "Cantrip" : `Lv ${lvl}`}
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={schoolFilter === "all"}
          onClick={() => setSchoolFilter("all")}
        >
          School: all
        </FilterChip>
        {SCHOOLS.map((s) => (
          <FilterChip
            key={s}
            active={schoolFilter === s}
            onClick={() => setSchoolFilter(s)}
          >
            <span className="capitalize">{s}</span>
          </FilterChip>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "spell" : "spells"}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No spells match these filters.</p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((spell) => {
            const data = spell.data as Record<string, unknown>;
            const level = data.level as number | undefined;
            const school = data.school as string | undefined;
            return (
              <li
                key={spell.id}
                className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2"
              >
                <span className="text-sm font-medium">{spell.name}</span>
                <span className="text-xs text-muted-foreground capitalize whitespace-nowrap">
                  {level === 0 ? "Cantrip" : `Lv ${level}`}
                  {school && ` · ${school}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        active
          ? "bg-accent/15 border-accent/50 text-accent"
          : "bg-transparent border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
