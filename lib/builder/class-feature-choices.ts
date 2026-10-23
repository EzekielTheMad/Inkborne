import type { CharacterChoices } from "@/lib/types/character";
import type { ChoiceEffect, Effect } from "@/lib/types/effects";

export type ClassFeatureChoiceSource = { content_definitions?: {
  slug?: string; content_type?: string; effects?: Effect[]; data?: Record<string, unknown>;
} | null };

export interface ClassFeatureChoiceContext {
  /** Discovery entries for options not selected yet. Active immutable refs
   * take precedence when an option already has a saved pin. */
  features?: readonly { slug: string; data: Record<string, unknown> }[];
  /** Exact saved physical spell selections, resolved through their versions. */
  knownSpellSlugs?: ReadonlySet<string>;
}

export function invocationCapacity(refs: readonly ClassFeatureChoiceSource[], choices: CharacterChoices): number | undefined {
  const classes = choices.classes?.filter(cls => cls.slug === "warlock");
  const sources = refs.flatMap(ref => ref.content_definitions?.content_type === "class" && ref.content_definitions.slug === "warlock"
    ? [ref.content_definitions] : []);
  if (classes?.length !== 1 || sources.length !== 1 || !Array.isArray(sources[0].data?.levels)) return;
  const tiers = sources[0].data.levels.filter(row => row && row.level === classes[0].level);
  if (tiers.length !== 1) return;
  const count = tiers[0].class_specific?.invocations_known;
  return Number.isInteger(count) && count >= 0 && count <= 8 ? count : undefined;
}

function invocationOptions(choice: ChoiceEffect, refs: readonly ClassFeatureChoiceSource[], choices: CharacterChoices,
  context: ClassFeatureChoiceContext): ChoiceEffect {
  const count = invocationCapacity(refs, choices);
  const level = choices.classes?.find(cls => cls.slug === "warlock")?.level ?? 0;
  const candidates = [...refs.flatMap(ref => ref.content_definitions?.content_type === "feature" && ref.content_definitions.slug
    ? [{ slug: ref.content_definitions.slug, data: ref.content_definitions.data ?? {} }] : []), ...(context.features ?? [])];
  const pactDefinitions = refs.flatMap(ref => ref.content_definitions?.effects ?? []).filter((effect): effect is ChoiceEffect =>
    effect.type === "choice" && effect.choice_id === "pact-boon");
  const pactDefinition = pactDefinitions.length === 1 ? pactDefinitions[0] : undefined;
  const savedPact = choices.resolved_choices?.["pact-boon"];
  const pact = pactDefinition?.grant_type === "feature" && Array.isArray(pactDefinition.from) && pactDefinition.choose === 1
    && savedPact?.length === 1 && pactDefinition.from.includes(savedPact[0]) ? savedPact : [];
  const from = !Array.isArray(choice.from) || count === undefined ? [] : choice.from.filter(slug => {
    const definition = candidates.find(candidate => candidate.slug === slug);
    const prerequisites = definition?.data.selection_prerequisites;
    return definition?.data.class === "warlock" && Array.isArray(prerequisites) && prerequisites.length > 0
      && prerequisites.every(prerequisite => prerequisite?.kind === "class_level"
        ? Number.isInteger(prerequisite.minimum) && prerequisite.minimum >= 1 && prerequisite.minimum <= level
        : prerequisite?.kind === "feature" ? typeof prerequisite.slug === "string" && pact.includes(prerequisite.slug)
          : prerequisite?.kind === "spell" ? typeof prerequisite.slug === "string"
            // Saved class status may lack a discovery spell catalog; the native
            // planner revalidates and prunes these when spell selections change.
            && (!context.knownSpellSlugs || context.knownSpellSlugs.has(prerequisite.slug)) : false);
  });
  return { ...choice, choose: count ?? choice.choose, from };
}

/** Additional picks earn new options, rather than another copy of an option
 * already owned by another active tier. Only valid, uniquely owned immutable
 * definitions may reserve an option. Database validation remains authoritative.
 */
export function resolveClassFeatureChoice(choice: ChoiceEffect, refs: readonly ClassFeatureChoiceSource[], choices: CharacterChoices,
  context: ClassFeatureChoiceContext = {}): ChoiceEffect {
  if (!["feature", "invocation", "favored_terrain"].includes(choice.grant_type)) return choice;
  const definitions = refs.flatMap(ref => ref.content_definitions?.effects ?? []).filter(effect => effect.type === "choice");
  const owners = (id: string) => definitions.filter(effect => effect.choice_id === id);
  if (!Array.isArray(choice.from) || owners(choice.choice_id).length !== 1) return { ...choice, from: [] };
  if (choice.grant_type === "invocation") return invocationOptions(choice, refs, choices, context);
  const occupied = new Set<string>();
  for (const other of definitions) {
    if (other.grant_type !== choice.grant_type || other.choice_id === choice.choice_id || owners(other.choice_id).length !== 1
      || !Array.isArray(other.from) || !Number.isInteger(other.choose) || other.choose < 1) continue;
    const selected = choices.resolved_choices?.[other.choice_id];
    if (!Array.isArray(selected) || selected.length > other.choose || new Set(selected).size !== selected.length
      || !selected.every(value => typeof value === "string" && other.from.includes(value))) continue;
    selected.forEach(value => occupied.add(value));
  }
  return { ...choice, from: choice.from.filter(value => !occupied.has(value)) };
}

export function resolveDefinitionClassFeatureChoices<T extends { effects?: Effect[] }>(definition: T,
  refs: readonly ClassFeatureChoiceSource[], choices: CharacterChoices, context: ClassFeatureChoiceContext = {}): T {
  return { ...definition, effects: definition.effects?.map(effect => effect.type === "choice"
    ? resolveClassFeatureChoice(effect, refs, choices, context) : effect) };
}
