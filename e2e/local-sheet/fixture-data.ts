import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { InventoryItem, Currency } from "@/lib/types/inventory";
import type { CharacterSpell } from "@/lib/types/spells";
import type { GrantEffect } from "@/lib/types/effects";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";

/** Original fictional loaded graphs for the existing dev provider. This data
 * has no print-model, ASI authority, conditional writer, or hosted dependency. */
export function localFixtureData(kind: "martial" | "caster") {
  const id = "11111111-1111-4111-8111-111111111111";
  const systemId = "99999999-9999-4999-8999-999999999999";
  const classSlug = kind === "martial" ? "fighter" : "wizard";
  const schema: SystemSchemaDefinition = {
    ability_scores: [
      { slug: "strength", name: "Strength", abbr: "STR" },
      { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
      { slug: "constitution", name: "Constitution", abbr: "CON" },
      { slug: "intelligence", name: "Intelligence", abbr: "INT" },
      { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
      { slug: "charisma", name: "Charisma", abbr: "CHA" },
    ],
    skills: [], proficiency_levels: [], derived_stats: [], resources: [],
    content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
  };
  const base = kind === "martial"
    ? { strength: 18, dexterity: 12, constitution: 14, intelligence: 16, wisdom: 10, charisma: 8 }
    : { strength: 10, dexterity: 14, constitution: 14, intelligence: 18, wisdom: 12, charisma: 8 };
  const currency: Currency = { cp: 1, sp: 2, ep: 0, gp: 42, pp: 0 };
  const state: CharacterState = { current_hp: 23, temp_hp: 4, currency, spell_slots_used: kind === "caster" ? { "1": 1 } : {} };
  const character: CharacterWithSystem = {
    id, user_id: "88888888-8888-4888-8888-888888888888", system_id: systemId, campaign_id: null,
    name: kind === "martial" ? "Mara Stonepath" : "Iven Lanternkeeper", visibility: "private", archived: false,
    level: 5, base_stats: base, choices: { classes: [{ slug: classSlug, level: 5 }], race: "human", background: "courier" },
    state, narrative: {}, narrative_rich: {}, created_at: "2026-10-23T10:00:00Z", primary_color: null,
    game_systems: { id: systemId, slug: "dnd-5e-2014", name: "D&D 5e 2014", schema_definition: schema },
  };
  const definition = {
    id: "22222222-2222-4222-8222-222222222222", system_id: systemId, version: 3,
    name: "Lantern Step", slug: "lantern-step", content_type: "feature", source: "homebrew" as const,
    effects: [], data: featureDataSchema.parse({ class: classSlug, level: 1,
      description: "Move quietly along a familiar route and guide your companions to shelter.", feature_type: "passive" }),
  };
  const ref: ContentRefWithContent = {
    id: "71111111-1111-4111-8111-111111111111", character_id: id, content_id: definition.id,
    content_version: 3, context: {}, choice_source: null, created_at: "2026-10-23T10:00:00Z", content_definitions: definition,
  };
  const contentRefs: ContentRefWithContent[] = [ref];
  const inventory: InventoryItem[] = [{ id: "rope-item", character_id: id, content_id: null,
    content_version: null, name: "Courier's Rope", content_type: "item", quantity: 2, equipped: false,
    attuned: false, sort_order: 0, notes: "", custom_data: { weight: 5, description: "A sturdy rope marked at regular intervals." }, created_at: "2026-10-23T10:00:00Z" }];
  const grants: GrantEffect[] = kind === "martial"
    ? [{ type: "grant", stat: "athletics", value: "expertise" }, { type: "grant", stat: "saving_throw_strength", value: "proficient" }, { type: "grant", stat: "martial_weapons", value: "proficient" }]
    : [{ type: "grant", stat: "arcana", value: "proficient" }, { type: "grant", stat: "saving_throw_intelligence", value: "proficient" }, { type: "grant", stat: "saving_throw_wisdom", value: "proficient" }];
  const spells: CharacterSpell[] = [];
  if (kind === "martial") {
    const weapon = { ...definition, id: "33333333-3333-4333-8333-333333333333", name: "Roadwarden Blade", slug: "roadwarden-blade", content_type: "weapon", data: { weapon_type: "martial melee", damage: "1d8", damage_type: "slashing", range: "5 ft", properties: ["versatile"], weight: 3 } };
    contentRefs.push({ ...ref, id: "71111111-1111-4111-8111-111111111112", content_id: weapon.id, content_definitions: weapon });
    inventory.push({ ...inventory[0], id: "weapon-item", name: weapon.name, content_type: "weapon", quantity: 1,
      equipped: true, content_id: weapon.id, content_version: 3, content_definitions: weapon, custom_data: null });
  } else {
    const spellId = "44444444-4444-4444-8444-444444444444";
    spells.push({ id: "lantern-spell", character_id: id, content_id: spellId, content_version: 3,
      name: "Guiding Lantern", class_slug: "wizard", is_known: true, is_prepared: true, always_prepared: false,
      in_spellbook: true, source: "selection", custom_data: null, created_at: "2026-10-23T10:00:00Z",
      content_definitions: { ...definition, id: spellId, slug: "guiding-lantern", content_type: "spell", name: "Guiding Lantern", data: {
        level: 1, school: "evocation", casting_time: "1 action", range: "60 feet", components: ["V", "S"], duration: "1 minute",
        description: "A gentle lantern illuminates a path through the mist.", higher_level: "A higher slot adds another lantern.", concentration: true,
      } } });
  }
  return { character, schema, contentRefs, inventory, spells, state, currency, maxHp: kind === "martial" ? 38 : 32, evalResult: { grants } };
}
