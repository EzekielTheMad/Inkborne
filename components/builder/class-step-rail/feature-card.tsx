import type { ContentEntry } from "@/components/builder/content-browser";

interface FeatureCardProps {
  feature: ContentEntry;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  const data = feature.data as Record<string, unknown>;
  const description = typeof data.description === "string" ? data.description : null;
  return (
    <article className="rounded-md border border-border bg-card/40 px-3 py-2.5">
      <h4 className="text-sm font-medium">{feature.name}</h4>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
    </article>
  );
}
