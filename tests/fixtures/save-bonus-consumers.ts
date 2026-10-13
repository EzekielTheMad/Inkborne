import { buildCustomActiveEffect, collectActiveEffects } from "@/lib/active-effects/helpers";
import { evaluate } from "@/lib/engine/evaluator";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { ClassContentData } from "@/lib/character/character-context";
import { raceParitySchema } from "./r06-race-parity";

/** Original synthetic canonical pins and explicitly modeled complete no-ASI read.
 * No class-role, hosted Auth, entitlement, grant authority or persistence proof. */
export function saveBonusFixture(extra: Effect[] = [], activeBonus: number | null = 1, proficient = true) {
  const characterId = "a6111111-1111-4111-8111-111111111111";
  const systemId = "a6222222-2222-4222-8222-222222222222";
  const ownerId = "a6333333-3333-4333-8333-333333333333";
  const raw = { id: "a6444444-4444-4444-8444-444444444444", system_id: systemId, version: 3,
    content_type: "feat", slug: "synthetic-lantern-poise", name: "Synthetic Lantern Poise", source: "homebrew",
    scope: "personal", owner_id: ownerId, data: { description: "Original fixture: steady footing while carrying a lantern." },
    effects: [...(proficient ? [{ type: "grant", stat: "saving_throw_constitution", value: "proficient" } as Effect] : []), ...extra] };
  const current = parseContentDefinition(raw);
  const pin = parseContentVersionSnapshot({ content_id: raw.id, version: raw.version, system_id_snapshot: systemId,
    content_type_snapshot: raw.content_type, slug_snapshot: raw.slug, name_snapshot: raw.name, data_snapshot: raw.data,
    effects_snapshot: raw.effects, source_snapshot: raw.source, scope_snapshot: raw.scope, owner_id_snapshot: ownerId });
  if (!current || !pin) throw new Error("The original save fixture must pass both actual content parsers.");
  const ref: ContentRefWithContent = { id: "a6555555-5555-4555-8555-555555555555", character_id: characterId,
    content_id: pin.id, content_version: pin.version, feature_grant_id: null, context: { source: "feat" }, choice_source: null,
    created_at: "2026-10-13T15:00:00.000Z", content_definitions: pin };
  // A genuine selected canonical class pin makes the modeled sheet coherent.
  // Its old transformer namespace deliberately stays unconsumed; this fixture
  // does not attest starting roles or repair the separate class-save gap.
  const classRaw = { ...raw, id: "a6888888-8888-4888-8888-888888888888", version: 2, content_type: "class",
    slug: "synthetic-lantern-steward", name: "Synthetic Lantern Steward",
    data: { description: "Original synthetic class for the consumer workflow.", hit_die: 8, spellcasting: null,
      multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: ["strength", "intelligence"], starting_proficiencies: [],
      levels: [1, 2, 3].map(level => ({ level, features: [], spellcasting: null })) },
    effects: [{ type: "grant", stat: "save_strength", value: "proficient" }, { type: "grant", stat: "save_intelligence", value: "proficient" }] };
  const classCurrent = parseContentDefinition(classRaw);
  const classPin = parseContentVersionSnapshot({ content_id: classRaw.id, version: classRaw.version, system_id_snapshot: systemId,
    content_type_snapshot: classRaw.content_type, slug_snapshot: classRaw.slug, name_snapshot: classRaw.name, data_snapshot: classRaw.data,
    effects_snapshot: classRaw.effects, source_snapshot: classRaw.source, scope_snapshot: classRaw.scope, owner_id_snapshot: ownerId });
  if (!classCurrent || !classPin) throw new Error("The selected original class must pass both actual content parsers.");
  const classRef: ContentRefWithContent = { ...ref, id: "a6999999-9999-4999-8999-999999999999", content_id: classPin.id,
    content_version: classPin.version, context: { source: "class" }, content_definitions: classPin };
  const active = activeBonus === null ? [] : [buildCustomActiveEffect({ name: "Original steady footing", stat: "saving_throw_bonus",
    value: activeBonus, duration: { type: "special" } }, { now: new Date("2026-10-13T15:00:00.000Z"),
    generateId: () => "a6666666-6666-4666-8666-666666666666" })];
  const state: CharacterState = { current_hp: 20, temp_hp: 0, active_effects: active };
  const schema = structuredClone(raceParitySchema);
  const character: CharacterWithSystem = { id: characterId, user_id: ownerId, system_id: systemId, campaign_id: null,
    name: "Original Lantern Courier", visibility: "private", archived: false, level: 3,
    base_stats: { strength: 10, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8,
      hit_die_total: 18, spellcasting_ability: 10 }, choices: { classes: [{ slug: classPin.slug, level: 3 }] }, state, narrative: {}, narrative_rich: {},
    primary_color: null, created_at: "2026-10-13T15:00:00.000Z",
    game_systems: { id: systemId, slug: "dnd-5e-2014", name: "D&D 5e 2014", schema_definition: schema } };
  const refs = [classRef, ref];
  const sources = buildCharacterStructuredSources(refs, character.level, { character, evidence: {
    status: "complete", character_id: characterId, system_id: systemId, refs, grants: [],
  } });
  const base = { ...character.base_stats, level: character.level };
  const contentEffects = refs.flatMap(row => row.content_definitions.effects);
  const effects = [...contentEffects, ...collectActiveEffects(active)];
  const result = evaluate(base, effects, schema, sources, state as Record<string, unknown>);
  const classData: ClassContentData = { [classPin.slug]: { slug: classPin.slug, data: classPin.data as ClassContentData[string]["data"] } };
  return { character, schema, raw, current, pin, refs, state, sources, base, contentEffects, classData, effects, result };
}
