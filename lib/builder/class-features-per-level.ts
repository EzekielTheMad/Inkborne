import type { ContentEntry } from "@/components/builder/content-browser";
import type { CharacterChoices } from "@/lib/types/character";

export type ChoiceType = "asi" | "subclass" | "fighting-style" | "generic";

export interface PerLevelChoice {
  type: ChoiceType;
  /** Feature slug that gates this choice — used as the choice id for ASI / fighting-style. */
  featureSlug?: string;
  classSlug: string;
  /** Display label for level pill summary + breadcrumb title. */
  label: string;
  /** True if the user has already made this choice. */
  isMade: boolean;
}

export interface PerLevel {
  level: number;
  features: ContentEntry[];
  choices: PerLevelChoice[];
}

interface LevelRow {
  level: number;
  features: string[];
}

export interface ClassFeaturesPerLevelArgs {
  classContent: ContentEntry;
  features: ContentEntry[];
  subclassContent: ContentEntry | null;
  characterChoices: CharacterChoices;
  classIndex: number;
}

export function classFeaturesPerLevel(args: ClassFeaturesPerLevelArgs): PerLevel[] {
  const { classContent, features, subclassContent, characterChoices, classIndex } = args;
  const classData = classContent.data as Record<string, unknown>;
  const classLevels = (classData.levels as LevelRow[] | undefined) ?? [];
  const subclassLevels =
    ((subclassContent?.data as Record<string, unknown> | undefined)?.levels as LevelRow[] | undefined) ?? [];

  // Merge feature slugs by level.
  const slugsByLevel = new Map<number, string[]>();
  for (const row of classLevels) {
    slugsByLevel.set(row.level, [...(slugsByLevel.get(row.level) ?? []), ...row.features]);
  }
  for (const row of subclassLevels) {
    slugsByLevel.set(row.level, [...(slugsByLevel.get(row.level) ?? []), ...row.features]);
  }

  const featureBySlug = new Map<string, ContentEntry>();
  for (const f of features) {
    featureBySlug.set(f.slug, f);
  }

  const classSlug = classContent.slug;
  const pickedSubclass = characterChoices.classes?.[classIndex]?.subclass;
  const asiChoices = characterChoices.asi_choices ?? {};
  const resolvedChoices = characterChoices.resolved_choices ?? {};

  const result: PerLevel[] = [];
  for (const [level, slugs] of slugsByLevel.entries()) {
    const featureEntries: ContentEntry[] = [];
    const choices: PerLevelChoice[] = [];

    for (const slug of slugs) {
      const f = featureBySlug.get(slug);
      if (!f) continue;
      const fdata = f.data as Record<string, unknown>;
      const featureType = fdata.feature_type as string | undefined;

      if (featureType === "subclass") {
        choices.push({
          type: "subclass",
          classSlug,
          label: f.name,
          isMade: !!pickedSubclass,
        });
        continue;
      }
      if (featureType === "asi") {
        choices.push({
          type: "asi",
          featureSlug: f.slug,
          classSlug,
          label: f.name,
          isMade: !!asiChoices[f.slug],
        });
        continue;
      }
      if (featureType === "fighting_style" && f.name === "Fighting Style") {
        const isMade = (resolvedChoices[f.slug] ?? []).length > 0;
        choices.push({
          type: "fighting-style",
          featureSlug: f.slug,
          classSlug,
          label: f.name,
          isMade,
        });
        continue;
      }
      // Skip child fighting-style entries (e.g. "Fighting Style: Archery") — those are
      // options under the parent choice, not their own per-level features.
      if (featureType === "fighting_style") continue;

      featureEntries.push(f);
    }

    if (featureEntries.length === 0 && choices.length === 0) continue;
    result.push({ level, features: featureEntries, choices });
  }

  result.sort((a, b) => a.level - b.level);
  return result;
}
