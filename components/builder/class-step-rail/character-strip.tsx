"use client";

import { ClassEmblem } from "@/components/builder/class-emblem";
import type { ContentEntry } from "@/components/builder/content-browser";

interface CharacterStripProps {
  characterName: string;
  totalLevel: number;
  maxLevel: number;
  classes: ContentEntry[];
  selectedClasses: Array<{ slug: string; level: number }>;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function CharacterStrip(props: CharacterStripProps) {
  const { characterName, totalLevel, maxLevel, classes, selectedClasses } = props;

  if (selectedClasses.length <= 1) return null;

  const initials = getInitials(characterName);

  return (
    <div
      role="region"
      aria-label="Character summary"
      className="flex items-center gap-3 border-b border-border bg-muted/10 px-4 py-2.5"
    >
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,_oklch(65%_0.18_300)_35%,_#1a1625)] text-xs font-semibold text-white"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{characterName}</p>
        <p className="text-[10.5px] text-muted-foreground">
          Lv {totalLevel}/{maxLevel} · merged slots
        </p>
      </div>
      <div aria-hidden="true" className="flex items-center gap-1.5">
        {selectedClasses.map((cls) => {
          const classContent = classes.find((c) => c.slug === cls.slug);
          if (!classContent) return null;
          return (
            <div key={cls.slug} className="flex items-center gap-0.5">
              <ClassEmblem slug={cls.slug} name={classContent.name} size="sm" />
              <span className="text-[11px] tabular-nums text-muted-foreground">{cls.level}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
