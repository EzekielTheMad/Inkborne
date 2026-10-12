import { hasLegacyRaceAbilityAmbiguity, type RaceAbilityData } from "@/lib/engine/race-ability-scores";
import type { Effect } from "@/lib/types/effects";

interface NoticeRef {
  content_definitions?: { content_type?: string; data?: unknown; effects?: Effect[] } | null;
}

export function RaceAbilityNotice({ contentRefs }: { contentRefs: NoticeRef[] }) {
  const race = contentRefs.find(ref => ref.content_definitions?.content_type === "race")?.content_definitions;
  if (!hasLegacyRaceAbilityAmbiguity(race?.data as RaceAbilityData | undefined, race?.effects ?? [])) return null;
  return <p role="status" className="text-sm text-muted-foreground">
    This saved race has ability bonuses in both scores and effects without a representation declaration.
    Both are retained, so totals may include overlapping bonuses. Its saved version is unchanged.
  </p>;
}
