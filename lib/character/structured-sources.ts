import type { StructuredSources } from "@/lib/engine/evaluator";
import { resolveCharacterAsiContributions, type AsiCharacter, type AsiEvidence } from "./asi-contributions";
import { resolveOwnedAncestryDefenses } from "./ancestry-defenses";

interface StructuredContentRef {
  id?: string;
  character_id?: string;
  content_id?: string;
  content_version?: number;
  feature_grant_id?: string | null;
  context?: unknown;
  choice_source?: string | null;
  created_at?: string;
  content_definitions?: {
    id?: string;
    slug?: string;
    version?: number;
    content_type?: string;
    data?: unknown;
  } | null;
}
const asiRefEnvelope = (ref: StructuredContentRef) => ({ id: ref.id, character_id: ref.character_id, content_id: ref.content_id,
  content_version: ref.content_version, feature_grant_id: ref.feature_grant_id, context: ref.context, choice_source: ref.choice_source,
  created_at: ref.created_at, content_definitions: ref.content_definitions });

/**
 * Assemble the structured JSON fields consumed by the evaluator. Feats share
 * the speed/vision/resistance/save-note shape used by class features, so both
 * content types must flow through the same live-sheet aggregation path.
 */
export function buildCharacterStructuredSources(
  contentRefs: StructuredContentRef[],
  level: number,
  asiInputs?: { character: AsiCharacter; evidence?: AsiEvidence },
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
    || ref.content_definitions?.content_type === "trait"
    || ref.content_definitions?.content_type === "subrace"
  );
  const classes = asiInputs?.character.choices.classes;
  const sameEvidence = asiInputs?.evidence?.status === "complete"
    && JSON.stringify(contentRefs.map(asiRefEnvelope)) === JSON.stringify(asiInputs.evidence.refs.map(asiRefEnvelope));
  const ancestryDefenses = asiInputs && sameEvidence ? resolveOwnedAncestryDefenses(asiInputs.character, asiInputs.evidence)
    : { status: "unavailable" as const, reason: "incomplete_evidence" as const };
  const classProgression = classes?.map(cls => {
    const pins = contentRefs.filter(ref => ref.content_definitions?.content_type === "class"
      && ref.content_definitions.slug === cls.slug && ref.content_id === ref.content_definitions.id
      && ref.content_version === ref.content_definitions.version);
    const data = pins.length === 1 ? pins[0].content_definitions?.data as StructuredSources["classData"] : undefined;
    return data && Number.isInteger(cls.level) && cls.level >= 1 && cls.level <= 20 ? { level: cls.level,
      attacks: data.attacks, improvements: data.improvements } : null;
  });

  return {
    asi: asiInputs ? asiInputs.evidence?.status === "complete" && !sameEvidence
      ? { status: "unavailable", reason: "incomplete_evidence" }
      : resolveCharacterAsiContributions(asiInputs.character, asiInputs.evidence) : undefined,
    ancestryDefenses,
    raceData: race?.content_definitions?.data as StructuredSources["raceData"],
    classData: characterClass?.content_definitions?.data as StructuredSources["classData"],
    ...(classProgression ? { classProgression: classProgression.some(source => source === null)
      ? [] : classProgression as NonNullable<StructuredSources["classProgression"]> } : {}),
    featureData: featuresAndFeats
      .map(
        (ref) => ref.content_definitions?.data as
          | NonNullable<StructuredSources["featureData"]>[number]
          | undefined,
      )
      .filter((data): data is NonNullable<typeof data> => Boolean(data))
      .concat(ancestryDefenses.status === "available" && ancestryDefenses.dmgres.length ? [{ dmgres: ancestryDefenses.dmgres }] : []),
    level,
  };
}
