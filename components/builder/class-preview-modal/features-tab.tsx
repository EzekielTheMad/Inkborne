import type { ContentEntry } from "@/components/builder/content-browser";

interface FeaturesTabProps {
  classContent: ContentEntry;
  features: ContentEntry[];
  previewLevel: number;
  previewSubclassSlug: string | null;
}

export function FeaturesTab({
  classContent,
  features,
  previewLevel,
  previewSubclassSlug,
}: FeaturesTabProps) {
  const data = classContent.data as Record<string, unknown>;
  const levels = (data.levels as Array<{ level: number; features: string[] }> | undefined) ?? [];

  const visibleByLevel = levels
    .filter((row) => row.level <= previewLevel)
    .map((row) => {
      const featureEntries = row.features
        .map((slug) => features.find((f) => f.slug === slug))
        .filter((f): f is ContentEntry => !!f)
        .filter((f) => {
          // Subclass-locked features only show if the user has previewed that subclass.
          const featureSubclass = (f.data as Record<string, unknown>).subclass as string | undefined;
          if (!featureSubclass) return true;
          return previewSubclassSlug === featureSubclass;
        });
      return { level: row.level, features: featureEntries };
    })
    .filter((row) => row.features.length > 0);

  if (visibleByLevel.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No features at this preview level.</p>
    );
  }

  return (
    <div className="space-y-5">
      {visibleByLevel.map(({ level, features: rowFeatures }) => (
        <section key={level}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Level {level}
          </h3>
          <ul className="space-y-2">
            {rowFeatures.map((feature) => {
              const featureData = feature.data as Record<string, unknown>;
              const description = typeof featureData.description === "string" ? featureData.description : null;
              return (
                <li
                  key={feature.id}
                  className="rounded-md border border-border bg-card/40 px-3 py-2"
                >
                  <p className="text-sm font-medium">{feature.name}</p>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
