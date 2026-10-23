import type { Effect } from "@/lib/types/effects";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { activeFeatureSlugs, fightingStyleSlugs, fixedLanguages, isAsiChoiceComplete, isChoiceComplete } from "./choice-validation";
import { hasCompleteAbilityScores } from "./ability-score-validation";
import type { CharacterChoices } from "@/lib/types/character";
import { isEquipmentConfirmed, isStructuredSelections } from "./equipment-choices";
import { resolveDefinitionExpertise } from "./expertise";
import { classRoleEvaluationRef, classRoleForRef, type BuilderClassRole } from "@/lib/character/builder-class-roles";
import { resolveDefinitionClassFeatureChoices } from "./class-feature-choices";
import { favoredEnemyOptions, isFavoredEnemyComplete } from "./favored-enemy";
import { unoccupiedFightingStyleSlugs } from "./class-features-per-level";

export type BuilderStepStatus = "complete" | "in_progress" | "untouched";

export const builderStepStatusLabels: Record<BuilderStepStatus, string> = {
  complete: "Saved",
  in_progress: "In progress",
  untouched: "Not started",
};

/** Minimal parsed snapshot shape; runtime fetchers validate the full envelope. */
export interface BuilderStatusRef {
  id?: string;
  class_role?: BuilderClassRole;
  content_id: string;
  content_version: number;
  context?: Record<string, unknown>;
  choice_source?: string | null;
  content_definitions: {
    id: string;
    name?: string;
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

function hasSavedChoices(definition: BuilderStatusRef["content_definitions"], choices: CharacterChoices, languages?: readonly string[], granted: readonly string[] = []) {
  return (definition.effects ?? []).every(effect => effect.type !== "choice" ||
    isChoiceComplete(effect, choices.resolved_choices?.[effect.choice_id] ?? [], languages, granted));
}

function hasSavedLevelChoices(definition: BuilderStatusRef["content_definitions"], level: number, classSlug: string, choices: CharacterChoices, refs: BuilderStatusRef[], languages?: readonly string[], granted: readonly string[] = []): boolean {
  return activeFeatureSlugs(definition, level).every(slug => {
    const feature = exactSavedPin("feature", slug, refs);
    if (!feature || !hasSavedChoices(feature, choices, languages, granted)) return false;
    if (feature.data.feature_type === "favored_enemy") {
      const other = refs.filter(ref => ref.content_definitions.slug !== slug && favoredEnemyOptions(ref.content_definitions))
        .flatMap(ref => { const saved = choices.favored_enemies?.[ref.content_definitions.slug];
          return isFavoredEnemyComplete(ref.content_definitions, saved, languages) ? [saved] : []; });
      return isFavoredEnemyComplete(feature, choices.favored_enemies?.[slug], languages, other);
    }
    if (feature.data.feature_type === "subclass") return !!choices.classes?.find(cls => cls.slug === classSlug)?.subclass;
    if (feature.data.feature_type === "asi") {
      const choice = choices.asi_choices?.[slug];
      if (!isAsiChoiceComplete(choice)) return false;
      if (choice?.mode !== "feat") return true;
      const matching = refs.filter(ref => ref.content_definitions.content_type === "feat" &&
        ref.content_id === choice.featId && ref.content_definitions.id === choice.featId &&
        ref.content_version === choice.featVersion && ref.content_definitions.version === choice.featVersion &&
        ref.context?.source === "asi_feat" && ref.context?.feature_slug === slug && ref.choice_source?.startsWith("choice:asi:"));
      return matching.length === 1;
    }
    if (feature.data.feature_type === "fighting_style" && (fightingStyleSlugs(feature).length > 0 || feature.name === "Fighting Style")) {
      const selected = choices.resolved_choices?.[slug] ?? [];
      const style = selected.length === 1 ? exactSavedPin("feature", selected[0], refs) : undefined;
      const allowed = fightingStyleSlugs(feature);
      const unoccupied = unoccupiedFightingStyleSlugs(feature, refs.map(ref => ref.content_definitions), choices);
      return !!style && style.name !== "Fighting Style" && style.data.class === classSlug && (allowed.length > 0
        ? unoccupied.includes(style.slug) : style.data.feature_type === "fighting_style");
    }
    return true;
  });
}

function hasSavedTraits(definition: BuilderStatusRef["content_definitions"], choices: CharacterChoices, refs: BuilderStatusRef[], languages?: readonly string[], granted: readonly string[] = []) {
  const traits = definition.data.traits;
  return !Array.isArray(traits) || traits.every(slug => {
    if (typeof slug !== "string") return false;
    // Enrolled builders pin the complete source-derived trait closure. Preserve
    // the older saved-evidence contract for existing un-enrolled characters.
    const enrolled = choices.classes?.some(cls => typeof cls.occurrence_id === "string");
    if (!enrolled && !refs.some(ref => ref.content_definitions.content_type === "trait" && ref.content_definitions.slug === slug)) return true;
    const trait = exactSavedPin("trait", slug, refs);
    return !!trait && hasSavedChoices(trait, choices, languages, granted);
  });
}

/** Saved core identity/reference consistency and schema-aware abilities.
 * Validates supported core/per-level/category choices from exact saved pins.
 * Enrolled builders require their source-derived trait pins.
 * Still not a whole-character playability or backend authorization verdict. */
export function getBuilderStepStatus(
  stepType: string,
  choices: CharacterChoices,
  baseStats: Record<string, number>,
  schema?: SystemSchemaDefinition,
  refs: BuilderStatusRef[] = [],
  languages?: readonly string[],
  classSpellsComplete = true,
): BuilderStepStatus {
  const sourceRefs = refs;
  refs = refs.map(ref => { const projected = classRoleEvaluationRef(ref, choices);
    return { ...projected, content_definitions: resolveDefinitionClassFeatureChoices(
      resolveDefinitionExpertise(projected.content_definitions, sourceRefs, choices), sourceRefs, choices) }; });
  const granted = fixedLanguages(refs.map(ref => ref.content_definitions));
  const countPins = (type: string) => refs.filter(ref => ref.content_definitions.content_type === type).length;
  switch (stepType) {
    case "class": {
      const classes = choices.classes;
      if (!classes?.length) return countPins("class") || countPins("subclass") ? "in_progress" : "untouched";
      if (!classSpellsComplete) return "in_progress";
      if (!Array.isArray(classes) || new Set(classes.map(cls => cls?.slug)).size !== classes.length ||
        countPins("class") !== classes.length || countPins("subclass") !== classes.filter(cls => cls?.subclass).length) return "in_progress";
      if (classes.length > 1 && sourceRefs.filter(ref => ref.content_definitions.content_type === "class")
        .some(ref => !classRoleForRef(ref, choices))) return "in_progress";
      return classes.every(cls => {
        if (!cls || typeof cls.slug !== "string" || !cls.slug.trim() ||
          !Number.isInteger(cls.level) || cls.level <= 0) return false;
        const definition = exactSavedPin("class", cls.slug, refs);
        const subclass = cls.subclass ? exactSavedPin("subclass", cls.subclass, refs) : undefined;
        return !!definition && hasSavedChoices(definition, choices, languages, granted) && hasSavedLevelChoices(definition, cls.level, cls.slug, choices, refs, languages, granted) &&
          (!cls.subclass || (subclass?.data.parent_class === cls.slug && hasSavedChoices(subclass, choices, languages, granted) && hasSavedLevelChoices(subclass, cls.level, cls.slug, choices, refs, languages, granted)));
      }) ? "complete" : "in_progress";
    }
    case "race": {
      if (!choices.race) return choices.subrace || countPins("race") || countPins("subrace") ? "in_progress" : "untouched";
      const race = exactSavedPin("race", choices.race, refs);
      const subrace = choices.subrace ? exactSavedPin("subrace", choices.subrace, refs) : undefined;
      return race && countPins("race") === 1 && countPins("subrace") === (choices.subrace ? 1 : 0) &&
        hasSavedChoices(race, choices, languages, granted) && hasSavedTraits(race, choices, refs, languages, granted) &&
        (!choices.subrace || (subrace?.data.parent_race === choices.race && hasSavedChoices(subrace, choices, languages, granted) && hasSavedTraits(subrace, choices, refs, languages, granted))) ? "complete" : "in_progress";
    }
    case "background": {
      if (!choices.background) return countPins("background") ? "in_progress" : "untouched";
      const definition = exactSavedPin("background", choices.background, refs);
      return countPins("background") === 1 && definition && hasSavedChoices(definition, choices, languages, granted) ? "complete" : "in_progress";
    }
    case "abilities":
      if (hasCompleteAbilityScores(choices.ability_method, baseStats, schema?.ability_scores,
        schema?.creation_steps?.find(step => step.type === "abilities")?.methods)) return "complete";
      return choices.ability_method ? "in_progress" : "untouched";
    case "equipment":
      if (isEquipmentConfirmed(choices.starting_equipment)) return "complete";
      return isStructuredSelections(choices.starting_equipment) ? "in_progress" : "untouched";
    case "details":
      return choices.details_confirmed === true ? "complete" : "untouched";
    default:
      return "untouched";
  }
}
