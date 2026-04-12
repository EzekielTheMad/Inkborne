"use client";

import type { ContentEntry } from "@/components/builder/content-browser";

interface SubclassSelectorProps {
  classSlug: string;
  subclasses: ContentEntry[];
  currentSelection: string | undefined;
  onSelect: (subclassSlug: string | undefined) => void;
  /** Override label from class data (e.g. "Sacred Oath", "Primal Path") */
  label?: string;
}

/**
 * Dropdown for selecting a subclass at the appropriate class level.
 * Filters available subclasses by parent_class matching the current class slug.
 */
export function SubclassSelector({
  classSlug,
  subclasses,
  currentSelection,
  onSelect,
  label,
}: SubclassSelectorProps) {
  const available = subclasses.filter(
    (sc) => sc.data.parent_class === classSlug,
  );

  if (available.length === 0) return null;

  // Use explicit label prop (from class data), fall back to subclass flavor_label, then "Subclass"
  const flavorLabel =
    label ??
    (typeof available[0]?.data.flavor_label === "string" && available[0].data.flavor_label
      ? available[0].data.flavor_label
      : "Subclass");

  return (
    <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <label className="block text-sm font-medium">
        Choose your {flavorLabel}
      </label>
      <select
        value={currentSelection ?? ""}
        onChange={(e) =>
          onSelect(e.target.value === "" ? undefined : e.target.value)
        }
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">-- Select --</option>
        {available.map((sc) => (
          <option key={sc.slug} value={sc.slug}>
            {sc.name}
          </option>
        ))}
      </select>

      {currentSelection && (() => {
        const selected = available.find((sc) => sc.slug === currentSelection);
        if (!selected) return null;
        const desc =
          typeof selected.data.description === "string"
            ? selected.data.description
            : null;
        return desc ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {desc}
          </p>
        ) : null;
      })()}
    </div>
  );
}
