import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { FeatureResource, ResourceRecovery } from "@/lib/types/resources";

/** Normalize schema recovery values to short/long. Dawn and day both map to long. */
export function normalizeRecovery(value: string | null | undefined): ResourceRecovery | null {
  if (value === "short rest") return "short";
  if (value === "long rest" || value === "dawn" || value === "day") return "long";
  return null;
}

/** Resolve max uses from a usages field (number or per-level array) at the given class level. */
export function getMaxUses(
  usages: number | Array<number | null> | undefined,
  classLevel: number,
): number {
  if (usages === undefined || usages === null) return 0;
  if (typeof usages === "number") return usages;
  if (classLevel < 1) return 0;
  const idx = classLevel - 1;
  if (idx >= usages.length) return 0;
  const val = usages[idx];
  return typeof val === "number" ? val : 0;
}

/** Title-case a single word/slug. */
function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Slugify an extra's name for use as a compound key suffix. */
function slugifyExtra(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Compute the full list of active feature resources for the character. */
export function computeResources(
  contentRefs: ContentRefWithContent[],
  classes: Array<{ slug: string; level: number }>,
): FeatureResource[] {
  const out: FeatureResource[] = [];

  for (const ref of contentRefs) {
    const def = ref.content_definitions;
    if (!def || def.content_type !== "feature") continue;

    const data = def.data as Record<string, unknown> | undefined;
    if (!data) continue;

    const classSlug = data.class as string | undefined;
    if (!classSlug) continue;

    const classEntry = classes.find((c) => c.slug === classSlug);
    if (!classEntry) continue;

    const classLevel = classEntry.level;
    const usages = data.usages as number | Array<number | null> | undefined;
    const recoveryRaw = data.recovery as string | null | undefined;
    const recovery = normalizeRecovery(recoveryRaw ?? null);
    const featureGainLevel = typeof data.level === "number" ? data.level : 1;
    const sourceLabel = `${titleCase(classSlug)} ${featureGainLevel}`;

    // Primary resource from usages + recovery
    if (recovery != null) {
      const max = getMaxUses(usages, classLevel);
      if (max > 0) {
        out.push({
          slug: def.slug,
          name: def.name,
          max,
          recovery,
          sourceLabel,
          sourceFeatureSlug: def.slug,
        });
      }
    }

    // Extra limited features — each becomes its own resource
    const extras = data.extraLimitedFeatures as
      | Array<{ name: string; usages: number; recovery: string }>
      | undefined;
    if (Array.isArray(extras)) {
      for (const extra of extras) {
        const extraRecovery = normalizeRecovery(extra.recovery);
        if (extraRecovery == null) continue;
        const extraMax = typeof extra.usages === "number" ? extra.usages : 0;
        if (extraMax <= 0) continue;
        const extraSlug = `${def.slug}.${slugifyExtra(extra.name)}`;
        out.push({
          slug: extraSlug,
          name: `${def.name}: ${extra.name}`,
          max: extraMax,
          recovery: extraRecovery,
          sourceLabel,
          sourceFeatureSlug: def.slug,
        });
      }
    }
  }

  return out;
}

/** Group resources by recovery type; each group sorted alphabetically by name. */
export function groupByRecovery(resources: FeatureResource[]): {
  short: FeatureResource[];
  long: FeatureResource[];
} {
  const short: FeatureResource[] = [];
  const long: FeatureResource[] = [];
  for (const r of resources) {
    (r.recovery === "short" ? short : long).push(r);
  }
  const cmp = (a: FeatureResource, b: FeatureResource) => a.name.localeCompare(b.name);
  short.sort(cmp);
  long.sort(cmp);
  return { short, long };
}
