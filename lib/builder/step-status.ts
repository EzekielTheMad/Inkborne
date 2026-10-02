import type { CharacterChoices } from "@/lib/types/character";
import { isEquipmentConfirmed, isStructuredSelections } from "./equipment-choices";

export type BuilderStepStatus = "complete" | "in_progress" | "untouched";

export const builderStepStatusLabels: Record<BuilderStepStatus, string> = {
  complete: "Complete",
  in_progress: "In progress",
  untouched: "Not started",
};

/** Saved-choice indicators, not validation that every required choice is resolved. */
export function getBuilderStepStatus(
  stepType: string,
  choices: CharacterChoices,
  baseStats: Record<string, number>,
): BuilderStepStatus {
  switch (stepType) {
    case "class":
      return choices.classes?.length ? "complete" : "untouched";
    case "race":
      return choices.race ? "complete" : "untouched";
    case "background":
      return choices.background ? "complete" : "untouched";
    case "abilities":
      if (choices.ability_method && Object.keys(baseStats).length > 0) return "complete";
      return choices.ability_method ? "in_progress" : "untouched";
    case "equipment":
      if (isEquipmentConfirmed(choices.starting_equipment)) return "complete";
      return isStructuredSelections(choices.starting_equipment) ? "in_progress" : "untouched";
    default:
      return "untouched";
  }
}
