import type { ContentEntry } from "@/components/builder/content-browser";

interface FeaturesTabProps {
  classContent: ContentEntry;
  features: ContentEntry[];
  subclasses: ContentEntry[];
  previewLevel: number;
  previewSubclassSlug: string | null;
}

interface LevelRow {
  level: number;
  features: string[];
}

export function FeaturesTab({
  classContent,
  features,
  subclasses,
  previewLevel,
  previewSubclassSlug,
}: FeaturesTabProps) {
  const classData = classContent.data as Record<string, unknown>;
  const classLevels = (classData.levels as LevelRow[] | undefined) ?? [];

  // If a subclass is previewed, also pull in features from its own levels.
  // Subclass-locked features live under the subclass's data.levels[], not
  // the parent class's, so we merge by level number.
  const subclassContent = previewSubclassSlug
    ? (subclasses ?? []).find(
        (sc) =>
          sc.slug === previewSubclassSlug &&
          (sc.data as Record<string, unknown>).parent_class === classContent.slug,
      )
    : null;
  const subclassLevels =
    ((subclassContent?.data as Record<string, unknown> | undefined)?.levels as LevelRow[] | undefined) ?? [];

  // Merge: for each level <= previewLevel, collect feature slugs from both
  // class and (optional) subclass.
  const mergedByLevel = new Map<number, string[]>();
  for (const row of classLevels) {
    if (row.level > previewLevel) continue;
    mergedByLevel.set(row.level, [...(mergedByLevel.get(row.level) ?? []), ...row.features]);
  }
  for (const row of subclassLevels) {
    if (row.level > previewLevel) continue;
    mergedByLevel.set(row.level, [...(mergedByLevel.get(row.level) ?? []), ...row.features]);
  }

  const visibleByLevel = Array.from(mergedByLevel.entries())
    .map(([level, slugs]) => ({
      level,
      features: slugs
        .map((slug) => features.find((f) => f.slug === slug))
        .filter((f): f is ContentEntry => !!f),
    }))
    .filter((row) => row.features.length > 0)
    .sort((a, b) => a.level - b.level);

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
