import type { CharacterChoices } from "@/lib/types/character";
import type { ChoiceEffect, Effect } from "@/lib/types/effects";

/** These readers receive the same active, immutable source snapshots as the
 * builder and sheet. A saved string alone never establishes proficiency. */
export type ExpertiseSource = { content_definitions?: {
  slug?: string; content_type?: string; data?: Record<string, unknown>; effects?: Effect[];
} | null };

const skills = new Set(["acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight",
  "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival"]);

function proficiency(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  if (value === "thieves-tools") return value;
  const skill = value.replace(/^skill-/, "");
  return skills.has(skill) ? `skill-${skill}` : undefined;
}

function finiteSelections(choice: ChoiceEffect, choices: CharacterChoices): string[] {
  const selected = choices.resolved_choices?.[choice.choice_id];
  if (!Array.isArray(choice.from) || !Number.isInteger(choice.choose) || choice.choose < 1 || !Array.isArray(selected)
    || selected.length > choice.choose || new Set(selected).size !== selected.length
    || !selected.every(value => typeof value === "string" && choice.from.includes(value))) return [];
  return selected;
}

function eligibleSources(refs: readonly ExpertiseSource[], choices: CharacterChoices): readonly ExpertiseSource[] {
  return refs.filter(ref => ref.content_definitions?.content_type !== "class"
    || (choices.classes?.length === 1 && choices.classes[0].slug === ref.content_definitions.slug));
}

export function expertiseProficiencies(refs: readonly ExpertiseSource[], choices: CharacterChoices): ReadonlySet<string> {
  const eligible = new Set<string>();
  const definitions = refs.flatMap(ref => ref.content_definitions?.effects ?? []).filter(effect => effect.type === "choice");
  const activeSources = eligibleSources(refs, choices);
  const add = (value: unknown) => { const slug = proficiency(value); if (slug) eligible.add(slug); };
  for (const ref of activeSources) {
    const definition = ref.content_definitions;
    if (!definition) continue;
    for (const effect of definition.effects ?? []) if (effect.type === "grant" && effect.value === "proficient") add(effect.stat);
    // First/secondary class roles must be proved separately before multiclass
    // proficiency data can be consumed. The current builder has one class.
    for (const field of ["skills", "toolProfs", ...(definition.content_type === "class" ? ["starting_proficiencies"] : [])]) {
      const values = definition.data?.[field];
      if (Array.isArray(values)) values.forEach(add);
    }
  }
  for (const choice of activeSources.flatMap(ref => ref.content_definitions?.effects ?? []).filter(effect => effect.type === "choice")) {
    if (!["proficiency", "skill", "tool"].includes(choice.grant_type)
      || definitions.filter(other => other.choice_id === choice.choice_id).length !== 1) continue;
    finiteSelections(choice, choices).forEach(add);
  }
  return eligible;
}

/** Keep a choice's original finite vocabulary, narrowed to earned proficiency
 * and excluding Expertise already assigned to another active source. */
export function resolveExpertiseChoice(choice: ChoiceEffect, refs: readonly ExpertiseSource[], choices: CharacterChoices): ChoiceEffect {
  if (choice.grant_type !== "expertise") return choice;
  const effects = eligibleSources(refs, choices).flatMap(ref => ref.content_definitions?.effects ?? []);
  const definitions = refs.flatMap(ref => ref.content_definitions?.effects ?? []).filter(effect => effect.type === "choice");
  const eligible = expertiseProficiencies(refs, choices);
  const occupied = new Set<string>();
  for (const effect of effects) {
    if (effect.type === "grant" && effect.value === "expertise") {
      const slug = proficiency(effect.stat); if (slug) occupied.add(slug);
    } else if (effect.type === "choice" && effect.grant_type === "expertise" && effect.choice_id !== choice.choice_id
      && definitions.filter(other => other.choice_id === effect.choice_id).length === 1) {
      finiteSelections(effect, choices).forEach(value => { const slug = proficiency(value); if (slug) occupied.add(slug); });
    }
  }
  return { ...choice, from: Array.isArray(choice.from) && definitions.filter(other => other.choice_id === choice.choice_id).length === 1
    ? choice.from.filter(value => { const slug = proficiency(value); return !!slug && eligible.has(slug) && !occupied.has(slug); }) : [] };
}

export function resolveDefinitionExpertise<T extends { effects?: Effect[] }>(definition: T, refs: readonly ExpertiseSource[], choices: CharacterChoices): T {
  return { ...definition, effects: definition.effects?.map(effect => effect.type === "choice" ? resolveExpertiseChoice(effect, refs, choices) : effect) };
}
