import type { StructuredSources } from "@/lib/engine/evaluator";

interface StructuredContentRef {
  content_definitions?: {
    content_type?: string;
    data?: unknown;
  } | null;
}

/**
 * Assemble the structured JSON fields consumed by the evaluator. Feats share
 * the speed/vision/resistance/save-note shape used by class features, so both
 * content types must flow through the same live-sheet aggregation path.
 */
export function buildCharacterStructuredSources(
  contentRefs: StructuredContentRef[],
  level: number,
): StructuredSources {
  const race = contentRefs.find(
    (ref) => ref.content_definitions?.content_type === "race",
  );
  const characterClass = contentRefs.find(
    (ref) => ref.content_definitions?.content_type === "class",
  );
  const featuresAndFeats = contentRefs.filter((ref) =>
    ref.content_definitions?.content_type === "feature"
    || ref.content_definitions?.content_type === "feat"
  );

  return {
    raceData: race?.content_definitions?.data as StructuredSources["raceData"],
    classData: characterClass?.content_definitions?.data as StructuredSources["classData"],
    featureData: featuresAndFeats
      .map(
        (ref) => ref.content_definitions?.data as
          | NonNullable<StructuredSources["featureData"]>[number]
          | undefined,
      )
      .filter((data): data is NonNullable<typeof data> => Boolean(data)),
    level,
  };
}
