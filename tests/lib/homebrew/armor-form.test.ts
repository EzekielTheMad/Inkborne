import { describe, expect, it } from "vitest";
import { mapHomebrewArmorFormData } from "@/lib/homebrew/armor-form";
import { armorDataSchema } from "@/lib/schemas/content-types/armor";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { generateArmorEffects } from "@/lib/inventory/armor-effects";

function form(overrides: Record<string, string> = {}) {
  const input = new FormData();
  for (const [key, value] of Object.entries({ name: "  Courier mail  ", armor_category: "Medium", cost_quantity: "45", cost_unit: " gp ",
    weight: "20", armor_class_base: "14", dex_bonus: "on", max_bonus: "2", str_minimum: "0", stealth_disadvantage: "on", ...overrides })) input.set(key, value);
  return input;
}

describe("private armor mapper", () => {
  it("maps only finite controls to actual nested armor data", () => {
    expect(mapHomebrewArmorFormData(form())).toEqual({ success: true, data: { name: "Courier mail", data: {
      armor_category: "Medium", cost: { quantity: 45, unit: "gp" }, weight: 20, armor_class: { base: 14, dex_bonus: true, max_bonus: 2 },
      str_minimum: 0, stealth_disadvantage: true,
    } } });
  });

  it.each([
    [{ armor_category: "Light", armor_class_base: "11", max_bonus: "" }, "11 + mod(dexterity)"],
    [{ armor_category: "Medium", max_bonus: "2" }, "14 + min(mod(dexterity), 2)"],
    [{ armor_category: "Medium", max_bonus: "0" }, "14 + min(mod(dexterity), 0)"],
    [{ armor_category: "Heavy", armor_class_base: "18", dex_bonus: "", max_bonus: "" }, "18"],
  ] as Array<[Record<string, string>, string]>)
  ("matches canonical body-armor parsing and existing helper expression for %j", (overrides, expression) => {
    const authored = mapHomebrewArmorFormData(form(overrides));
    if (!authored.success) throw new Error("Expected valid body armor");
    const parsed = parseContentDefinition({ id: "11111111-1111-4111-8111-111111111111", system_id: "22222222-2222-4222-8222-222222222222",
      slug: "courier-mail", name: authored.data.name, data: authored.data.data, content_type: "armor", version: 1,
      source: "homebrew", scope: "personal", owner_id: "33333333-3333-4333-8333-333333333333", effects: [] });
    expect(parsed?.data).toEqual(authored.data.data);
    const canonical = armorDataSchema.parse(parsed?.data);
    expect(generateArmorEffects(canonical)).toMatchObject([{ type: "mechanical", stat: "armor_class", op: "formula", expr: expression }]);
    // This proves pure helper/parser parity, not actual provider/evaluator AC.
  });

  it("retains nullable blanks versus explicit zero and small numeric reloads", () => {
    expect(mapHomebrewArmorFormData(form({ cost_quantity: "", cost_unit: "", weight: "", max_bonus: "", str_minimum: "", stealth_disadvantage: "" })))
      .toMatchObject({ success: true, data: { data: { cost: null, weight: null, armor_class: { max_bonus: null }, str_minimum: 0, stealth_disadvantage: false } } });
    expect(mapHomebrewArmorFormData(form({ cost_quantity: "0", weight: "0", armor_class_base: "0", max_bonus: "0" })))
      .toMatchObject({ success: true, data: { data: { cost: { quantity: 0 }, weight: 0, armor_class: { base: 0, max_bonus: 0 } } } });
    expect(mapHomebrewArmorFormData(form({ weight: "0.0000001", cost_quantity: "0.0000001" })))
      .toEqual(mapHomebrewArmorFormData(form({ weight: "1e-7", cost_quantity: "1e-7" })));
  });

  it.each(["-1", "NaN", "Infinity", "0x10", "1e309", "9007199254740992", "2 lb"])("rejects invalid numeric controls %s", (value) => {
    expect(mapHomebrewArmorFormData(form({ weight: value, cost_quantity: value }))).toMatchObject({ success: false,
      fieldErrors: { weight: expect.arrayContaining([expect.any(String)]), cost_quantity: expect.arrayContaining([expect.any(String)]) } });
  });

  it("requires a whole-number base, bounds text, validates category/pairs and rejects irrelevant caps", () => {
    expect(mapHomebrewArmorFormData(form({ armor_class_base: "" }))).toMatchObject({ success: false, fieldErrors: { armor_class_base: [expect.any(String)] } });
    expect(mapHomebrewArmorFormData(form({ armor_class_base: "14.5", max_bonus: "0.5", str_minimum: "1.5" })))
      .toMatchObject({ success: false, fieldErrors: { armor_class_base: [expect.any(String)], max_bonus: [expect.any(String)], str_minimum: [expect.any(String)] } });
    expect(mapHomebrewArmorFormData(form({ name: "x".repeat(101), cost_unit: "x".repeat(21), armor_category: "Plate" })))
      .toMatchObject({ success: false, fieldErrors: { name: [expect.any(String)], cost_unit: [expect.any(String)], armor_category: [expect.any(String)] } });
    expect(mapHomebrewArmorFormData(form({ dex_bonus: "" }))).toMatchObject({ success: false, fieldErrors: { max_bonus: [expect.any(String)] } });
    expect(mapHomebrewArmorFormData(form({ cost_unit: "" }))).toMatchObject({ success: false, fieldErrors: { cost_unit: [expect.any(String)] } });
    expect(mapHomebrewArmorFormData(form({ cost_quantity: "" }))).toMatchObject({ success: false, fieldErrors: { cost_quantity: [expect.any(String)] } });
  });

  it("ignores forged ownership, raw payload/effects and extra metadata controls", () => {
    expect(mapHomebrewArmorFormData(form({ owner_id: "attacker", system_id: "attacker", content_type: "spell", source: "srd", scope: "shared", version: "99",
      data: '{"armor_class":{"base":99}}', effects: "[]", description: "Injected lore", custom_metadata: "{}", armor_class: "{}", cost: "{}" })))
      .toEqual(mapHomebrewArmorFormData(form()));
  });
});
