"use client";

import { useMemo } from "react";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

interface SpellsTabProps {
  contentRefs: ContentRefWithContent[];
}

export function SpellsTab({ contentRefs }: SpellsTabProps) {
  const spellRefs = useMemo(
    () =>
      contentRefs.filter(
        (ref) => ref.content_definitions?.content_type === "spell",
      ),
    [contentRefs],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground italic">
        Spell management coming in a future update.
      </p>

      {spellRefs.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Known Spells
          </h3>
          <div className="space-y-1.5">
            {spellRefs.map((ref) => {
              const data = ref.content_definitions?.data ?? {};
              const level = data.level != null ? Number(data.level) : null;
              const school = (data.school as string) ?? "";
              return (
                <div
                  key={ref.id}
                  className="flex items-baseline justify-between gap-2 px-2 py-1.5 rounded border border-border bg-card"
                >
                  <span className="text-sm text-accent font-medium">
                    {ref.content_definitions?.name ?? "Unknown Spell"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {level === 0
                      ? "Cantrip"
                      : level != null
                        ? `Level ${level}`
                        : ""}
                    {school ? ` \u00b7 ${school}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
