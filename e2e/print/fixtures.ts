import type { CharacterPrintInput } from "@/lib/character/print-model";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { weaponDataSchema } from "@/lib/schemas/content-types/weapon";

/** Original, rights-safe renderer fixtures. These model loaded evaluated values;
 * they do not establish rule-engine parity or live character hydration. */
export function printFixture(kind: "martial" | "caster" | "long"): CharacterPrintInput {
  const id = "11111111-1111-4111-8111-111111111111";
  const contentId = "22222222-2222-4222-8222-222222222222";
  const definition = { id: contentId, system_id: "system", version: 3, name: "Lantern Step", slug: "lantern-step", content_type: "feature", source: "homebrew" as const, effects: [], data: { description: "Move quietly along a familiar route and guide your companions to shelter." } };
  const ref = { feature_grant_id: null, id: "ref", character_id: id, content_id: contentId, content_version: 3, context: { dm_secret: "FORBIDDEN_CONTEXT" }, choice_source: null, created_at: "2026-10-11", content_definitions: definition } satisfies ContentRefWithContent;
  const schema = {
    ability_scores: [{ slug: "strength", name: "Strength", abbr: "STR" }, { slug: "dexterity", name: "Dexterity", abbr: "DEX" }, { slug: "constitution", name: "Constitution", abbr: "CON" }, { slug: "intelligence", name: "Intelligence", abbr: "INT" }, { slug: "wisdom", name: "Wisdom", abbr: "WIS" }, { slug: "charisma", name: "Charisma", abbr: "CHA" }],
    skills: [{ slug: "arcana", name: "Arcana", ability: "intelligence" }, { slug: "athletics", name: "Athletics", ability: "strength" }, { slug: "perception", name: "Perception", ability: "wisdom" }], proficiency_levels: [], derived_stats: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
  };
  const character = { id, user_id: "owner", system_id: "system", campaign_id: "campaign", name: kind === "martial" ? "Mara Stonepath" : kind === "caster" ? "Iven Lanternkeeper" : "Tess Manyroads", visibility: "private" as const, archived: false, level: 5, base_stats: {}, choices: { classes: [{ slug: kind === "martial" ? "fighter" : "wizard", level: 5 }], race: "human", background: "courier" }, state: {}, narrative: { backstory: "FORBIDDEN_NARRATIVE" }, narrative_rich: { backstory_dm_notes: { type: "doc", content: [{ type: "text", text: "FORBIDDEN_DM" }] } }, created_at: "2026-10-11", primary_color: null, game_systems: { id: "system", slug: "dnd-5e-2014", name: "D&D 5e 2014", schema_definition: schema } } as CharacterPrintInput["character"];
  const ctx: CharacterPrintInput = {
    mechanics: { status: "available", capUnverified: false }, assertMechanics: () => {},
    character, schema, isOwner: true, hasSheet: true, reloadRequired: false, contentSnapshotsComplete: true,
    patchState: Object.assign(async () => true, { hasPendingWrites: () => false, runAction: async () => undefined }) as unknown as CharacterPrintInput["patchState"],
    rollPersistencePending: false, rollPersistenceUncertain: false, pendingConcentrationCheck: null,
    evalResult: { stats: { strength: 18, strength_mod: 4, dexterity: 12, dexterity_mod: 1, constitution: 14, constitution_mod: 2, intelligence: 16, intelligence_mod: 3, wisdom: 10, wisdom_mod: 0, charisma: 8, charisma_mod: -1 }, computed: { armor_class: 17, proficiency_bonus: 3, initiative: 1 }, grants: [{ type: "grant", stat: "athletics", value: "expertise" }, { type: "grant", stat: "saving_throw_strength", value: "proficient" }], narratives: [], speed: { walk: 30 }, vision: [], dmgres: [], savetxt: { adv_vs: [], immune: [] }, attacks: 2, improvements: false, asi: { status: "available", allocations: [], effects: [] } },
    state: { current_hp: 23, temp_hp: 4, notes: "FORBIDDEN_NOTES", quick_notes: "FORBIDDEN_QUICK", currency: { cp: 1, sp: 2, ep: 0, gp: 42, pp: 0 }, spell_slots_used: { "1": 1 } },
    maxHp: 38, contentRefs: [ref], inventory: [], spells: [], currency: { cp: 1, sp: 2, ep: 0, gp: 42, pp: 0 }, resources: [], hitDicePools: [{ classSlug: "fighter", die: 10, max: 5, spent: 2 }], casterInfo: { isCaster: false, classes: [], spellDc: 0, spellAttackBonus: 0 }, slotResolution: { status: "available", maxSlots: {}, pactSlotLevel: null }, maxSlots: {}, slotState: {}, pactSlotLevel: null, concentration: null,
  };
  ctx.inventory = [{ id: "item", character_id: id, content_id: null, content_version: null, name: "Courier's Rope", content_type: "equipment", quantity: 2, equipped: false, attuned: false, sort_order: 0, notes: "FORBIDDEN_ITEM_NOTE", custom_data: { weight: 5, description: "A sturdy rope marked at regular intervals.", secret: "FORBIDDEN_CUSTOM" }, created_at: "2026-10-11" }];
  if (kind === "martial") {
    const weapon = { ...definition, id: "33333333-3333-4333-8333-333333333333", name: "Roadwarden Blade", slug: "roadwarden-blade", content_type: "weapon", data: weaponDataSchema.parse({ weapon_category: "Martial", weapon_range: "Melee", damage: { dice: "1d8", type: "slashing" }, range: { normal: 5 }, properties: ["versatile"], two_handed_damage: { dice: "1d10", type: "slashing" }, weight: 3, source_refs: [] }) };
    ctx.contentRefs.push({ ...ref, id: "weapon-ref", content_id: weapon.id, content_definitions: weapon });
    ctx.evalResult.grants.push({ type: "grant", stat: "martial_weapons", value: "proficient" });
    ctx.inventory.push({ ...ctx.inventory[0], id: "weapon-item", name: weapon.name, content_type: "weapon", quantity: 1, equipped: true, content_id: weapon.id, content_version: 3, content_definitions: weapon, custom_data: null });
  }
  if (kind !== "martial") {
    ctx.evalResult.stats = { strength: 10, strength_mod: 0, dexterity: 14, dexterity_mod: 2, constitution: 14, constitution_mod: 2, intelligence: 18, intelligence_mod: 4, wisdom: 12, wisdom_mod: 1, charisma: 8, charisma_mod: -1 };
    ctx.evalResult.computed = { armor_class: 12, proficiency_bonus: 3, initiative: 2 };
    ctx.evalResult.grants = [{ type: "grant", stat: "arcana", value: "proficient" }, { type: "grant", stat: "saving_throw_intelligence", value: "proficient" }, { type: "grant", stat: "saving_throw_wisdom", value: "proficient" }];
    ctx.evalResult.attacks = 1;
    ctx.maxHp = 32;
    ctx.hitDicePools = [{ classSlug: "wizard", die: 6, max: 5, spent: 2 }];
    ctx.state.hit_dice_spent = { wizard: 2 };
    ctx.casterInfo = { isCaster: true, classes: [{ slug: "wizard", level: 5, type: "full", ability: "intelligence", prepared: true, cantripsKnown: 3, spellsKnown: "all", maxPrepared: 9, ritualCasting: true }], spellDc: 15, spellAttackBonus: 7 };
    ctx.maxSlots = { "1": 4, "2": 3, "3": 2 }; ctx.slotResolution = { status: "available", maxSlots: ctx.maxSlots, pactSlotLevel: null }; ctx.slotState = { "1": 1 };
    ctx.resources = [{ slug: "lantern-step", name: "Lantern Step", max: 3, recovery: "long", sourceLabel: "Wizard 5", sourceFeatureSlug: "lantern-step" }];
    const spellId = "44444444-4444-4444-8444-444444444444";
    ctx.spells = [{ id: "spell", character_id: id, content_id: spellId, content_version: 3, name: "Guiding Lantern", class_slug: "wizard", is_known: true, is_prepared: true, always_prepared: false, in_spellbook: true, source: "selection", custom_data: null, created_at: "2026-10-11", content_definitions: { ...definition, id: spellId, content_type: "spell", name: "Guiding Lantern", data: { level: 1, school: "evocation", casting_time: "1 action", range: "60 feet", components: ["V", "S"], duration: "1 minute", description: "A gentle lantern illuminates a path through the mist.", higher_level: "A higher slot adds another lantern.", concentration: true } } }];
  }
  if (kind === "long") {
    const paragraph = "Travelers mark safe paths with small lanterns. Follow the lights across the hillside, take shelter from the rain, and record the next landmark in your journal. ";
    ctx.contentRefs = Array.from({ length: 12 }, (_, index) => {
      const pinnedId = `55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`;
      return { ...ref, id: `ref-${index}`, content_id: pinnedId, content_definitions: { ...definition, id: pinnedId, name: `Road Lesson ${index + 1}`, data: { description: paragraph.repeat(index === 0 ? 50 : 3) + `FEATURE_END_${index + 1}` } } };
    });
    ctx.inventory = Array.from({ length: 28 }, (_, index) => ({ ...ctx.inventory[0], id: `item-${index}`, name: `Travel Bundle ${index + 1}`, quantity: index + 1 }));
    ctx.spells = Array.from({ length: 14 }, (_, index) => {
      const pinnedId = `66666666-6666-4666-8666-${String(index + 1).padStart(12, "0")}`;
      return { ...ctx.spells[0], id: `spell-${index}`, content_id: pinnedId, name: `Lantern Pattern ${index + 1}`, content_definitions: { ...ctx.spells[0].content_definitions!, id: pinnedId, name: `Lantern Pattern ${index + 1}`, data: { ...ctx.spells[0].content_definitions!.data, description: paragraph.repeat(4) + `SPELL_END_${index + 1}` } } };
    });
  }
  return ctx;
}
