"use client";

import { useMemo } from "react";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

interface InventoryTabProps {
  character: CharacterWithSystem;
  contentRefs: ContentRefWithContent[];
}

export function InventoryTab({ character, contentRefs }: InventoryTabProps) {
  // Collect equipment-like content refs (weapons, equipment, items)
  const equipmentRefs = useMemo(() => {
    const equipTypes = new Set(["weapon", "equipment", "item", "armor", "shield", "tool"]);
    return contentRefs.filter((ref) =>
      equipTypes.has(ref.content_definitions?.content_type ?? ""),
    );
  }, [contentRefs]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground italic">
        Full inventory management coming in a future update.
      </p>

      {equipmentRefs.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Equipment
          </h3>
          <div className="space-y-1.5">
            {equipmentRefs.map((ref) => {
              const data = ref.content_definitions?.data ?? {};
              const quantity =
                ref.context?.quantity != null
                  ? Number(ref.context.quantity)
                  : 1;
              const weight = data.weight != null ? Number(data.weight) : null;

              return (
                <div
                  key={ref.id}
                  className="flex items-baseline justify-between gap-2 px-2 py-1.5 rounded border border-border bg-card"
                >
                  <span className="text-sm text-foreground">
                    {ref.content_definitions?.name ?? "Unknown Item"}
                    {quantity > 1 && (
                      <span className="text-muted-foreground">
                        {" "}
                        x{quantity}
                      </span>
                    )}
                  </span>
                  {weight != null && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {weight} lb
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {equipmentRefs.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No equipment found. Add items via the character builder.
        </p>
      )}
    </div>
  );
}
