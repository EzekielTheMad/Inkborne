import { describe, expect, it } from "vitest";
import { mapHomebrewWeaponFormData } from "@/lib/homebrew/weapon-form";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";

function form(overrides: Record<string, string> = {}, properties = ["versatile"]) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "  Oathblade  ", weapon_category: "Martial", weapon_range: "Melee",
    cost_quantity: "15", cost_unit: " gp ", weight: "2.5", damage_dice: "1d8", damage_type: "slashing",
    range_normal: "", range_long: "", two_handed_damage_dice: "1d10", two_handed_damage_type: "slashing", ...overrides })) data.set(key, value);
  properties.forEach((property) => data.append("properties", property));
  return data;
}

describe("private weapon form mapper", () => {
  it("creates only canonical core data and round trips through the inventory parser", () => {
    const result = mapHomebrewWeaponFormData(form());
    expect(result).toEqual({ success: true, data: { name: "Oathblade", data: { weapon_category: "Martial", weapon_range: "Melee",
      cost: { quantity: 15, unit: "gp" }, weight: 2.5, damage: { dice: "1d8", type: "slashing" }, range: null,
      properties: ["versatile"], two_handed_damage: { dice: "1d10", type: "slashing" } } } });
    if (!result.success) throw new Error("Expected valid core data");
    const definition = parseContentDefinition({ id: "11111111-1111-4111-8111-111111111111", system_id: "22222222-2222-4222-8222-222222222222",
      slug: "oathblade", name: result.data.name, data: result.data.data, content_type: "weapon", version: 1,
      source: "homebrew", scope: "personal", owner_id: "33333333-3333-4333-8333-333333333333", effects: [] });
    expect(definition?.data.damage).toEqual({ dice: "1d8", type: "slashing" });
    expect(definition?.data.monkweapon).toBe(false);
    expect(result.data.data).not.toHaveProperty("monkweapon");
  });

  it("accepts ranged and thrown canonical range with optional long range", () => {
    expect(mapHomebrewWeaponFormData(form({ weapon_range: "Ranged", range_normal: "80", range_long: "320" }, ["ammunition"])))
      .toMatchObject({ success: true, data: { data: { range: { normal: 80, long: 320 } } } });
    expect(mapHomebrewWeaponFormData(form({ range_normal: "20" }, ["thrown"])))
      .toMatchObject({ success: true, data: { data: { range: { normal: 20 } } } });
  });

  it("preserves unspecified cost/weight/alternate damage as null and accepts explicit zero and tiny decimals", () => {
    expect(mapHomebrewWeaponFormData(form({ cost_quantity: "", cost_unit: "", weight: "", two_handed_damage_dice: "", two_handed_damage_type: "" }, [])))
      .toMatchObject({ success: true, data: { data: { cost: null, weight: null, two_handed_damage: null, properties: [] } } });
    expect(mapHomebrewWeaponFormData(form({ cost_quantity: "0", weight: "0" }))).toMatchObject({ success: true, data: { data: { cost: { quantity: 0 }, weight: 0 } } });
    expect(mapHomebrewWeaponFormData(form({ cost_quantity: "0.0000001", weight: "0.0000001" })))
      .toEqual(mapHomebrewWeaponFormData(form({ cost_quantity: "1e-7", weight: "1e-7" })));
  });

  it.each(["-1", "-1e-7", "NaN", "Infinity", "0x10", "1e309", "9007199254740992", "2 lb"])("rejects invalid numeric controls %s", (value) => {
    expect(mapHomebrewWeaponFormData(form({ cost_quantity: value, weight: value, range_normal: value })))
      .toMatchObject({ success: false, fieldErrors: { cost_quantity: [expect.any(String)], weight: [expect.any(String)], range_normal: [expect.any(String)] } });
  });

  it.each(["", "not dice", "0d6", "101d6", "1d1001", "1d8+", "1d8+9007199254740992"])("rejects unusable damage expression %s", (value) => {
    expect(mapHomebrewWeaponFormData(form({ damage_dice: value }))).toMatchObject({ success: false, fieldErrors: { damage_dice: [expect.any(String)] } });
  });

  it("checks actual enums, known properties, length limits, cost pairs, alternate damage pairs and range consistency", () => {
    expect(mapHomebrewWeaponFormData(form({ weapon_category: "Legendary", weapon_range: "Far", damage_type: "physical" }, ["unknown"])))
      .toMatchObject({ success: false, fieldErrors: { weapon_category: [expect.any(String)], weapon_range: [expect.any(String)], damage_type: [expect.any(String)], properties: [expect.any(String)] } });
    expect(mapHomebrewWeaponFormData(form({ name: "x".repeat(101), cost_unit: "x".repeat(21), damage_dice: "1".repeat(101) })))
      .toMatchObject({ success: false, fieldErrors: { name: [expect.any(String)], cost_unit: [expect.any(String)], damage_dice: expect.arrayContaining([expect.any(String)]) } });
    const invalidPairs: Array<Record<string, string>> = [{ cost_unit: "" }, { cost_quantity: "" }, { range_normal: "0" }, { range_normal: "20", range_long: "10" },
      { range_long: "30" }, { weapon_range: "Ranged" }, { two_handed_damage_type: "" }, { two_handed_damage_dice: "" }];
    for (const overrides of invalidPairs) {
      expect(mapHomebrewWeaponFormData(form(overrides))).toMatchObject({ success: false });
    }
    expect(mapHomebrewWeaponFormData(form({}, ["versatile", "versatile"]))).toMatchObject({ success: false, fieldErrors: { properties: [expect.any(String)] } });
    expect(mapHomebrewWeaponFormData(form({}, ["thrown"]))).toMatchObject({ success: false, fieldErrors: { range_normal: [expect.any(String)] } });
  });

  it("ignores forged identity, effects and extended canonical values", () => {
    expect(mapHomebrewWeaponFormData(form({ owner_id: "attacker", system_id: "attacker", scope: "shared", source: "srd", content_type: "spell", version: "99",
      effects: "[]", ability: "6", monkweapon: "true", ammo: "bolt", baseWeapon: "dagger", source_refs: '[{"book":"Injected"}]', data: '{}' })))
      .toEqual(mapHomebrewWeaponFormData(form()));
  });
});
