import { weaponDataSchema } from "@/lib/schemas/content-types/weapon";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { printFixture } from "./fixtures";

/** Original names and mechanics parsed through the actual supported schema. */
export function canonicalWeaponRef(kind: "melee" | "ranged" | "finesse"): ContentRefWithContent {
  const variants = {
    melee: { id: "77777777-7777-4777-8777-000000000001", name: "Trail Mallet", slug: "trail-mallet", weapon_category: "Simple", weapon_range: "Melee", damage: { dice: "1d6", type: "bludgeoning" }, range: { normal: 5 }, properties: [] },
    ranged: { id: "77777777-7777-4777-8777-000000000002", name: "Ridge Bow", slug: "ridge-bow", weapon_category: "Martial", weapon_range: "Ranged", damage: { dice: "1d8", type: "piercing" }, range: { normal: 120, long: 480 }, properties: ["ammunition", "two-handed"] },
    finesse: { id: "77777777-7777-4777-8777-000000000003", name: "Courier Needle", slug: "courier-needle", weapon_category: "Martial", weapon_range: "Melee", damage: { dice: "1d8", type: "piercing" }, range: { normal: 5 }, properties: ["finesse"] },
  };
  const weapon = variants[kind];
  return {
    id: weapon.id, character_id: "11111111-1111-4111-8111-111111111111", content_id: weapon.id,
    content_version: 3, context: {}, choice_source: null, created_at: "2026-10-11",
    content_definitions: { id: weapon.id, system_id: "system", version: 3, name: weapon.name, slug: weapon.slug, content_type: "weapon", source: "homebrew", effects: [], data: weaponDataSchema.parse({ ...weapon, weight: 2, source_refs: [] }) },
  };
}

export function canonicalWeaponPrintFixture() {
  const ctx = printFixture("martial");
  ctx.character.name = "Sable Trailwarden";
  const refs = [canonicalWeaponRef("melee"), canonicalWeaponRef("ranged"), canonicalWeaponRef("finesse")];
  const missing = canonicalWeaponRef("melee");
  missing.id = "77777777-7777-4777-8777-000000000004";
  missing.content_id = missing.id;
  missing.content_definitions = { ...missing.content_definitions, id: missing.id, name: "Practice Baton", slug: "practice-baton", data: { ...missing.content_definitions.data, damage: null } };
  ctx.contentRefs = [...refs, missing];
  ctx.inventory = ctx.contentRefs.map(ref => ({ ...ctx.inventory[0], id: `item-${ref.id}`, content_id: ref.content_id, content_version: ref.content_version, name: ref.content_definitions.name, content_type: "weapon", quantity: 1, equipped: true, content_definitions: ref.content_definitions, custom_data: null }));
  ctx.evalResult.stats = { ...ctx.evalResult.stats, strength: 12, strength_mod: 1, dexterity: 18, dexterity_mod: 4 };
  ctx.evalResult.computed = { ...ctx.evalResult.computed, armor_class: 14, initiative: 4 };
  ctx.evalResult.grants = [{ type: "grant", stat: "simple_weapons", value: "proficient" }];
  return ctx;
}
