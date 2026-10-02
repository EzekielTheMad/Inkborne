import type { Effect } from "@/lib/types/effects";
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

/** Minimal parsed snapshot shape; runtime fetchers validate the full envelope. */
export interface BuilderStatusRef {
  content_id: string;
  content_version: number;
  content_definitions: {
    id: string;
    slug: string;
    content_type: string;
    version: number;
    data: Record<string, unknown>;
    effects?: Effect[];
  };
}

function exactSavedPin(type: string, slug: string, refs: BuilderStatusRef[]) {
  const matching = refs.filter(ref => ref.content_definitions.content_type === type &&
    ref.content_definitions.slug === slug);
  if (matching.length !== 1) return undefined;
  const pin = matching[0];
  return pin.content_id === pin.content_definitions.id &&
    Number.isInteger(pin.content_version) && pin.content_version > 0 &&
    pin.content_version === pin.content_definitions.version ? pin.content_definitions : undefined;
}

/** Validate choices whose entire option set is in the pinned definition.
 * Category-based sources and per-level feature choices need their own resolvers. */
function hasSavedExplicitChoices(definition: BuilderStatusRef["content_definitions"], choices: CharacterChoices) {
  return (definition.effects ?? []).every(effect => {
    if (effect.type !== "choice" || !Array.isArray(effect.from)) return true;
    if (!Number.isInteger(effect.choose) || effect.choose < 1 || !effect.choice_id) return false;
    const selected = choices.resolved_choices?.[effect.choice_id] ?? [];
    return Array.isArray(selected) && selected.length === effect.choose &&
      new Set(selected).size === selected.length && selected.every(value => effect.from.includes(value));
  });
}

/** Saved core identity/reference consistency and schema-aware abilities.
 * Complete validates explicit choices on selected core definitions, not every
 * per-level feature/category choice or playability. */
export function getBuilderStepStatus(
  stepType: string,
  choices: CharacterChoices,
  baseStats: Record<string, number>,
  schema?: SystemSchemaDefinition,
  refs: BuilderStatusRef[] = [],
): BuilderStepStatus {
  const countPins = (type: string) => refs.filter(ref => ref.content_definitions.content_type === type).length;
  switch (stepType) {
    case "class": {
      const classes = choices.classes;
      if (!classes?.length) return "untouched";
      if (!Array.isArray(classes) || new Set(classes.map(cls => cls?.slug)).size !== classes.length ||
        countPins("class") !== classes.length || countPins("subclass") !== classes.filter(cls => cls?.subclass).length) return "in_progress";
      return classes.every(cls => {
        if (!cls || typeof cls.slug !== "string" || !cls.slug.trim() ||
          !Number.isInteger(cls.level) || cls.level <= 0) return false;
        const definition = exactSavedPin("class", cls.slug, refs);
        const subclass = cls.subclass ? exactSavedPin("subclass", cls.subclass, refs) : undefined;
        return !!definition && hasSavedExplicitChoices(definition, choices) &&
          (!cls.subclass || (subclass?.data.parent_class === cls.slug && hasSavedExplicitChoices(subclass, choices)));
      }) ? "complete" : "in_progress";
    }
    case "race": {
      if (!choices.race) return "untouched";
      const race = exactSavedPin("race", choices.race, refs);
      const subrace = choices.subrace ? exactSavedPin("subrace", choices.subrace, refs) : undefined;
      return race && countPins("race") === 1 && countPins("subrace") === (choices.subrace ? 1 : 0) &&
        hasSavedExplicitChoices(race, choices) &&
        (!choices.subrace || (subrace?.data.parent_race === choices.race && hasSavedExplicitChoices(subrace, choices))) ? "complete" : "in_progress";
    }
    case "background": {
      if (!choices.background) return "untouched";
      const definition = exactSavedPin("background", choices.background, refs);
      return countPins("background") === 1 && definition && hasSavedExplicitChoices(definition, choices) ? "complete" : "in_progress";
    }
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
