// Original approved race fixture with only its Node seed read replaced by the bound injected schema.
import { transformRaceEntry } from "../../scripts/transformers/races";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { evaluate } from "@/lib/engine/evaluator";
import type { Effect } from "@/lib/types/effects";

// Entirely original synthetic API-shaped fixture: no fetch, hosted row or book
// text. Calling the actual transformer is the provenance of THIS reproduction.
export const syntheticApiRace: Parameters<typeof transformRaceEntry>[0] = {
  index: "r06-synthetic-lantern-kin", name: "Synthetic Lantern Kin", speed: 35,
  ability_bonuses: [
    { ability_score: { index: "str", name: "STR" }, bonus: 2 },
    { ability_score: { index: "con", name: "CON" }, bonus: 2 },
  ],
  size: "Medium", size_description: "Original synthetic size notes.",
  age: "Original synthetic age notes.", alignment: "Original synthetic alignment notes.",
  language_desc: "Original synthetic language notes.",
  languages: [], traits: [], subraces: [], starting_proficiencies: [],
};
declare global { interface Window { asiSeedSchema: unknown } }
// The runner extracts only the actual2014 schema from the byte-bound root seed;
// no Node filesystem shim or guessed schema/default reaches the browser.
export const raceParitySchema = systemSchemaDefinitionSchema.parse(window.asiSeedSchema);
export const raceParityBase = {
  strength: 10, dexterity: 10, constitution: 12, intelligence: 10,
  wisdom: 10, charisma: 10, level: 3, hit_die_total: 18, spellcasting_ability: 10,
};
export const transformedRace = transformRaceEntry(syntheticApiRace);
// Frozen original transformer output captured by R06.1 at 7403cb0. Never
// regenerate a historical dual pin using the new import representation.
const legacyTransformedRace = {
  content_type: "race", slug: syntheticApiRace.index, name: syntheticApiRace.name,
  data: { size: "Medium", speed: 35, speed_detail: { walk: 35 }, scores: [2, 0, 2, 0, 0, 0],
    age_description: syntheticApiRace.age, alignment_description: syntheticApiRace.alignment,
    size_description: syntheticApiRace.size_description, language_description: syntheticApiRace.language_desc,
    traits: [], subraces: [], languages: [], weaponProfs: [], armorProfs: [], toolProfs: [],
  },
  effects: [
    { type: "mechanical", stat: "strength", op: "add", value: 2 },
    { type: "mechanical", stat: "constitution", op: "add", value: 2 },
    { type: "mechanical", stat: "movement_speed", op: "set", value: 35 },
    { type: "mechanical", stat: "size", op: "set", value: "Medium" },
  ] as Effect[],
};
export const isAbilityAdd = (effect: Effect) => effect.type === "mechanical" && effect.op === "add"
  && raceParitySchema.ability_scores.some(ability => ability.slug === effect.stat);

export function syntheticRacePin(representation: "dual" | "scores-only" | "effects-only" | "imported" | "declared-effects" | "declared-scores" = "dual", extra: Effect[] = [], version = 1) {
  const source = representation === "imported" ? transformedRace : legacyTransformedRace;
  const data: Record<string, unknown> = { ...source.data };
  if (representation === "effects-only") delete data.scores;
  if (representation === "declared-effects" || representation === "declared-scores") {
    data.ability_score_representation = { version: 1, mode: representation === "declared-effects" ? "effects" : "scores" };
  }
  const effects = [...(representation === "scores-only" ? source.effects.filter(effect => !isAbilityAdd(effect)) : source.effects), ...extra];
  const raw = { ...source, data, effects,
    id: "11111111-1111-4111-8111-111111111111", system_id: "22222222-2222-4222-8222-222222222222",
    version, source: "srd", scope: "platform", owner_id: null,
  };
  const definition = parseContentDefinition(raw);
  const snapshot = { content_id: raw.id, version, system_id_snapshot: raw.system_id,
    content_type_snapshot: raw.content_type, slug_snapshot: raw.slug, name_snapshot: raw.name,
    data_snapshot: data, effects_snapshot: effects, source_snapshot: raw.source,
    scope_snapshot: raw.scope, owner_id_snapshot: raw.owner_id,
  };
  const pin = parseContentVersionSnapshot(snapshot);
  if (!definition || !pin) throw new Error("Synthetic transformed content must pass both actual parsers");
  return { raw, definition, snapshot, pin };
}

export function pinnedRaceRef(pin: ReturnType<typeof syntheticRacePin>["pin"]) {
  return { id: "33333333-3333-4333-8333-333333333333", content_id: pin.id,
    content_version: pin.version, context: { source: "race" }, choice_source: null,
    content_definitions: pin,
  };
}

export function evaluateSyntheticPin(pin: ReturnType<typeof syntheticRacePin>["pin"], state: Record<string, unknown> = {}) {
  return evaluate(raceParityBase, pin.effects, raceParitySchema,
    buildCharacterStructuredSources([pinnedRaceRef(pin)], raceParityBase.level), state);
}
