"use client";

import { cn } from "@/lib/utils";

export type CategoryPill =
  | "Armor"
  | "Weapon"
  | "Potion"
  | "Ring"
  | "Rod"
  | "Scroll"
  | "Staff"
  | "Wand"
  | "Wondrous"
  | "Gear";

export const CATEGORY_PILLS: CategoryPill[] = [
  "Armor",
  "Weapon",
  "Potion",
  "Ring",
  "Rod",
  "Scroll",
  "Staff",
  "Wand",
  "Wondrous",
  "Gear",
];

interface ItemFiltersProps {
  selected: CategoryPill | null;
  onSelect: (pill: CategoryPill | null) => void;
  magicalOnly: boolean;
  onMagicalToggle: (value: boolean) => void;
}

export function ItemFilters({
  selected,
  onSelect,
  magicalOnly,
  onMagicalToggle,
}: ItemFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {CATEGORY_PILLS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => onSelect(selected === pill ? null : pill)}
            className={cn(
              "text-xs px-2 py-1 rounded-full border transition-colors",
              selected === pill
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            {pill}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={magicalOnly}
          onChange={(e) => onMagicalToggle(e.target.checked)}
          className="rounded border-border"
        />
        Magical only
      </label>
    </div>
  );
}
