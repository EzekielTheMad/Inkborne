"use client";

import { useState, useMemo } from "react";
import type { CharacterWithSystem } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

/** Standard filter categories */
const BASE_FILTERS = [
  { id: "all", label: "All" },
  { id: "feature", label: "Class Features" },
  { id: "trait", label: "Species Traits" },
  { id: "feat", label: "Feats" },
] as const;

interface FeaturesTabProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  contentRefs: ContentRefWithContent[];
}

export function FeaturesTab({
  character,
  schema,
  contentRefs,
}: FeaturesTabProps) {
  const [activeFilter, setActiveFilter] = useState("all");

  // Identify custom content types present in the character's content refs
  const customPills = useMemo(() => {
    const standardTypes = new Set(["feature", "trait", "feat", "weapon", "spell", "equipment", "item"]);
    const customTypes = new Map<string, string>();

    for (const ref of contentRefs) {
      const ct = ref.content_definitions?.content_type;
      if (ct && !standardTypes.has(ct)) {
        if (!customTypes.has(ct)) {
          // Look up display name from schema content_types
          const def = schema.content_types.find((t) => t.slug === ct);
          customTypes.set(ct, def?.name ?? ct.replace(/_/g, " "));
        }
      }
    }

    return Array.from(customTypes.entries()).map(([slug, name]) => ({
      id: slug,
      label: name,
    }));
  }, [contentRefs, schema.content_types]);

  const allFilters = [...BASE_FILTERS, ...customPills];

  // Filter content refs based on active filter
  const filteredRefs = useMemo(() => {
    const featureTypes = new Set(["feature", "trait", "feat"]);
    const customSlugs = new Set(customPills.map((p) => p.id));

    // Only include feature-like refs and custom content types
    const relevant = contentRefs.filter((ref) => {
      const ct = ref.content_definitions?.content_type;
      return ct && (featureTypes.has(ct) || customSlugs.has(ct));
    });

    if (activeFilter === "all") return relevant;
    return relevant.filter(
      (ref) => ref.content_definitions?.content_type === activeFilter,
    );
  }, [contentRefs, activeFilter, customPills]);

  // Derive source citation from content ref context and character choices
  function getSourceCitation(ref: ContentRefWithContent): string {
    const ct = ref.content_definitions?.content_type;
    if (ct === "trait") return "Species Trait";
    if (ct === "feat") return "Feat";
    if (ct === "feature") {
      // Try to figure out which class this feature comes from
      const source = ref.choice_source;
      if (source) {
        // choice_source might be like "class_rogue_3"
        const parts = source.split("_");
        if (parts.length >= 2) {
          const className = parts.slice(1, -1).join(" ");
          const level = parts[parts.length - 1];
          if (className && !isNaN(Number(level))) {
            return `${capitalize(className)} ${level}`;
          }
        }
      }
      return "Class Feature";
    }
    // Custom content type
    const def = schema.content_types.find((t) => t.slug === ct);
    return def?.name ?? ct ?? "Feature";
  }

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {allFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activeFilter === filter.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Feature list */}
      {filteredRefs.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No features match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredRefs.map((ref) => (
            <div
              key={ref.id}
              className="rounded-md border border-border bg-card p-3 space-y-1"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-accent font-medium text-sm">
                  {ref.content_definitions?.name ?? "Unknown Feature"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {getSourceCitation(ref)}
                </span>
              </div>
              {ref.content_definitions?.data?.description != null && (
                <p className="text-sm text-foreground">
                  {String(ref.content_definitions.data.description)}
                </p>
              )}
              {/* Show resolved choices if any */}
              {ref.context?.resolved_choices != null &&
                typeof ref.context.resolved_choices === "object" && (
                  <div className="pl-3 border-l-2 border-border">
                    {Object.entries(
                      ref.context.resolved_choices as Record<string, string[]>,
                    ).map(([key, values]) => (
                      <p key={key} className="text-xs text-muted-foreground">
                        {capitalize(key.replace(/_/g, " "))}
                        {": "}
                        {Array.isArray(values) ? values.join(", ") : String(values)}
                      </p>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
