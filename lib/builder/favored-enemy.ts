export type FavoredEnemyChoice = {
  selection: { mode: "type"; enemy_type: string } | { mode: "humanoids"; races: string[] };
  language: string | null;
};

export type FavoredEnemyOptions = { enemy_types: string[]; humanoid_races: string[] };
type Definition = { data?: Record<string, unknown> };

export function favoredEnemyOptions(definition: Definition): FavoredEnemyOptions | null {
  if (definition.data?.feature_type !== "favored_enemy") return null;
  const raw = definition.data.favored_enemy as Partial<FavoredEnemyOptions> | undefined;
  const finite = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 &&
    new Set(value).size === value.length && value.every(item => typeof item === "string" && /^[a-z][a-z-]*$/.test(item));
  return raw && finite(raw.enemy_types) && finite(raw.humanoid_races)
    ? { enemy_types: raw.enemy_types, humanoid_races: raw.humanoid_races } : null;
}

/** Conditional tracking/recall benefits remain narrative. This validates only
 * the supported SRD choice vocabulary, not campaign-specific creature speech. */
export function isFavoredEnemyComplete(definition: Definition, value: unknown,
  languages?: readonly string[], otherChoices: readonly FavoredEnemyChoice[] = []): value is FavoredEnemyChoice {
  const options = favoredEnemyOptions(definition);
  if (!options || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const choice = value as Partial<FavoredEnemyChoice>, selection = choice.selection;
  if (Object.keys(choice).sort().join() !== "language,selection" || !selection || typeof selection !== "object" ||
    (choice.language !== null && (typeof choice.language !== "string" || !languages?.includes(choice.language)))) return false;
  if (selection.mode === "type") return Object.keys(selection).sort().join() === "enemy_type,mode" &&
    options.enemy_types.includes(selection.enemy_type) && !otherChoices.some(other =>
      other.selection.mode === "type" && other.selection.enemy_type === selection.enemy_type);
  return selection.mode === "humanoids" && Object.keys(selection).sort().join() === "mode,races" &&
    Array.isArray(selection.races) && selection.races.length === 2 && new Set(selection.races).size === 2 &&
    selection.races.every(race => options.humanoid_races.includes(race) && !otherChoices.some(other =>
      other.selection.mode === "humanoids" && other.selection.races.includes(race)));
}

/** Exact loaded feature pins constrain language grants. No saved choice can
 * supply an arbitrary effect or unconditional advantage. */
export function favoredEnemyLanguages(refs: readonly { content_definitions?: Definition & { slug?: string; content_type?: string } | null }[],
  choices: { favored_enemies?: Record<string, FavoredEnemyChoice> }, languages?: readonly string[]): string[] {
  const values: string[] = [];
  for (const ref of refs) {
    const definition = ref.content_definitions;
    if (!definition?.slug || definition.content_type !== "feature") continue;
    const choice = choices.favored_enemies?.[definition.slug];
    const vocabulary = languages ?? refs.flatMap(item => item.content_definitions?.content_type === "language" &&
      item.content_definitions.slug ? [item.content_definitions.slug] : []);
    if (isFavoredEnemyComplete(definition, choice, vocabulary) && choice.language) values.push(choice.language);
  }
  return [...new Set(values)];
}
