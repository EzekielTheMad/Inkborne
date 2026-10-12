import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { syntheticRacePin, raceParityBase, raceParitySchema } from "./r06-race-parity";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { AsiEvidence, FrozenFeatureGrant } from "@/lib/character/asi-contributions";
import type { CharacterWithSystem, AsiChoice } from "@/lib/types/character";
import type { Effect } from "@/lib/types/effects";
export const asiId = (last: number) => `a1111111-1111-4111-8111-${String(last).padStart(12, "0")}`;
export const asiInstant = "2026-10-12T16:00:00.000Z";
export const asiSchema = raceParitySchema;

/** Entirely original synthetic class/occurrence, actual definition AND immutable parser. */
export function originalAsiPin(content_type: string, slug: string, data: Record<string, unknown>, id: string, effects: Effect[] = []) {
  const raw = { id, system_id: asiId(2), version: 1, content_type, slug, name: `Original ${slug}`, data, effects,
    source: "homebrew", scope: "personal", owner_id: asiId(3) };
  if (!parseContentDefinition(raw)) throw new Error("Original ASI definition must parse");
  const pin = parseContentVersionSnapshot({ content_id: id, version: 1, system_id_snapshot: raw.system_id, content_type_snapshot: content_type,
    slug_snapshot: slug, name_snapshot: raw.name, data_snapshot: data, effects_snapshot: effects, source_snapshot: raw.source, scope_snapshot: raw.scope,
    owner_id_snapshot: raw.owner_id, created_at: asiInstant });
  if (!pin) throw new Error("Original ASI immutable pin must parse");
  return pin;
}
export function originalAsiFixture(choice: AsiChoice = { mode: "asi", allocations: [{ ability: "strength", amount: 2 }] }) {
  const cls = originalAsiPin("class", "original-guard", { hit_die: 8, spellcasting: null, multiclass: { prerequisites: [], proficiencies_gained: [] },
    saving_throws: ["constitution"], starting_proficiencies: [], levels: Array.from({ length: 20 }, (_, index) => ({ level: index + 1,
      features: index === 3 ? ["original-guard-improvement-4"] : [], spellcasting: null })) }, asiId(10));
  const feature = originalAsiPin("feature", "original-guard-improvement-4", { class: cls.slug, subclass: null, level: 4,
    feature_type: "asi", description: "Original improvement used to test saved contributions." }, asiId(11));
  const race = { ...syntheticRacePin("imported").pin, system_id: asiId(2) };
  const grant: FrozenFeatureGrant = { id: asiId(20), character_id: asiId(1), controller_ref_id: asiId(30), controller_type: "class", controller_slug: cls.slug,
    feature_content_id: feature.id, feature_version: feature.version, feature_slug: feature.slug, unlock_level: 4, created_at: asiInstant };
  const ref = (definition: typeof cls, id: string, feature_grant_id: string | null = null, choice_source: string | null = null): ContentRefWithContent => ({
    id, character_id: asiId(1), content_id: definition.id, content_version: definition.version, feature_grant_id,
    context: feature_grant_id === null ? {} : { source: "class_feature", controller_type: grant.controller_type, controller_slug: grant.controller_slug, feature_slug: grant.feature_slug, feature_level: grant.unlock_level },
    choice_source: feature_grant_id === null ? choice_source : `auto:feature-grant:${feature_grant_id}`, created_at: asiInstant, content_definitions: definition,
  });
  const refs = [ref(cls, asiId(30)), ref(feature, asiId(31), grant.id), ref(race, asiId(32))];
  const character = { id: asiId(1), system_id: asiId(2), user_id: asiId(3), name: "Original ASI Character", campaign_id: null,
    visibility: "private", archived: false, level: 4, base_stats: { ...raceParityBase, level: 4 }, primary_color: null, created_at: asiInstant,
    state: { current_hp: 5, temp_hp: 0, hit_dice_spent: { [cls.slug]: 0 } }, narrative: {}, narrative_rich: {},
    choices: { classes: [{ slug: cls.slug, level: 4 }], race: race.slug, ability_method: "manual",
      asi_choices: { [feature.slug]: choice }, hp_rolls: { [`${cls.slug}-2`]: { method: "manual", value: 4 }, [`${cls.slug}-3`]: { method: "rolled", value: 6 }, [`${cls.slug}-4`]: { method: "average", value: 5 } } },
    game_systems: { id: asiId(2), slug: "dnd-5e-2014", name: "Original test system", schema_definition: asiSchema },
  } as CharacterWithSystem;
  const evidence: Extract<AsiEvidence, { status: "complete" }> = { status: "complete", character_id: character.id, system_id: character.system_id, refs, grants: [grant] };
  return { character, evidence, refs, grant, cls, feature, race, ref };
}
