import type { SystemSchemaDefinition } from "@/lib/types/system";
import { hasCompleteAbilityScores } from "./ability-score-validation";
import type { CharacterChoices } from "@/lib/types/character";
import { isEquipmentConfirmed, isStructuredSelections } from "./equipment-choices";

export type BuilderStepStatus = "complete" | "in_progress" | "untouched";

export const builderStepStatusLabels: Record<BuilderStepStatus, string> = {
  complete: "Complete",
  in_progress: "In progress",
  untouched: "Not started",
};

/** Saved step status: abilities use schema/editor rules. Other steps still
 * indicate selected identities, not full pinned-reference/subchoice readiness. */
export function getBuilderStepStatus(
  stepType: string,
  choices: CharacterChoices,
  baseStats: Record<string, number>,
  schema?: SystemSchemaDefinition,
): BuilderStepStatus {
  switch (stepType) {
    case "class":
      return choices.classes?.length ? "complete" : "untouched";
    case "race":
      return choices.race ? "complete" : "untouched";
    case "background":
      return choices.background ? "complete" : "untouched";
    case "abilities":
      if (hasCompleteAbilityScores(choices.ability_method, baseStats, schema?.ability_scores,
        schema?.creation_steps?.find(step => step.type === "abilities")?.methods)) return "complete";
      return choices.ability_method ? "in_progress" : "untouched";
    case "equipment":
      if (isEquipmentConfirmed(choices.starting_equipment)) return "complete";
      return isStructuredSelections(choices.starting_equipment) ? "in_progress" : "untouched";
    default:
      return "untouched";
  }
}
