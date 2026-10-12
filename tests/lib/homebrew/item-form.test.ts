import { describe, expect, it } from "vitest";

import { mapHomebrewItemFormData } from "@/lib/homebrew/item-form";
import { parseContentDefinition, parseNestedContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";

function form(overrides: Record<string, string> = {}) {
  const input = new FormData();
  for (const [key, value] of Object.entries({ name: "  Folding Lantern  ", equipment_category: "  Adventuring Gear  ",
    description: "  A hinged travel lantern.  ", cost_quantity: "2.5", cost_unit: " gp ", weight: "1.25", ...overrides })) input.set(key, value);
  return input;
}

describe("ordinary item authoring", () => {
  it("round trips authored data through the canonical Library and pinned inventory parsers", () => {
    const result = mapHomebrewItemFormData(form());
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected valid item");
    expect(result.data).toEqual({ name: "Folding Lantern", data: { equipment_category: "Adventuring Gear",
      description: "A hinged travel lantern.", cost: { quantity: 2.5, unit: "gp" }, weight: 1.25 } });
    const row = { id: "11111111-1111-4111-8111-111111111111", system_id: "22222222-2222-4222-8222-222222222222",
      slug: "folding-lantern", name: result.data.name, data: result.data.data, content_type: "item", version: 1,
      source: "homebrew", scope: "personal", owner_id: "33333333-3333-4333-8333-333333333333", effects: [] };
    const pin = { content_id: row.id, version: 1, system_id_snapshot: row.system_id, content_type_snapshot: row.content_type,
      slug_snapshot: row.slug, name_snapshot: row.name, data_snapshot: row.data, effects_snapshot: [],
      source_snapshot: row.source, scope_snapshot: row.scope, owner_id_snapshot: row.owner_id };
    const latest = parseContentDefinition({ ...row, version: 2, data: { ...row.data, weight: 3 } });
    expect(latest?.data.weight).toBe(3);
    expect(parseNestedContentVersionSnapshot(pin)?.data).toEqual(result.data.data);
    expect(parseNestedContentVersionSnapshot(pin)?.version).toBe(1);
  });

  it("preserves optional unspecified fields as canonical empty/null values and accepts zero", () => {
    const result = mapHomebrewItemFormData(form({ equipment_category: "", description: "", cost_quantity: "", cost_unit: "", weight: "" }));
    expect(result).toEqual({ success: true, data: { name: "Folding Lantern", data: { equipment_category: "", description: "", cost: null, weight: null } } });
    expect(mapHomebrewItemFormData(form({ cost_quantity: "0", weight: "0" }))).toMatchObject({ success: true, data: { data: { cost: { quantity: 0 }, weight: 0 } } });
  });

  it.each(["-1", "-1e-7", "NaN", "Infinity", "1e309", "0x10", "2 lb", "9007199254740992"])("rejects invalid numeric control %s", (value) => {
    expect(mapHomebrewItemFormData(form({ weight: value, cost_quantity: value }))).toMatchObject({ success: false,
      fieldErrors: { weight: [expect.any(String)], cost_quantity: [expect.any(String)] } });
  });

  it("reloads accepted small decimal weight and cost through their serialized edit values", () => {
    const created = mapHomebrewItemFormData(form({ weight: "0.0000001", cost_quantity: "0.0000001" }));
    expect(created.success).toBe(true);
    if (!created.success) throw new Error("Expected valid decimal item");
    const reloaded = mapHomebrewItemFormData(form({
      weight: String(created.data.data.weight),
      cost_quantity: String(created.data.data.cost!.quantity),
    }));
    expect(reloaded).toEqual(created);
    expect(mapHomebrewItemFormData(form({ weight: "1e2", cost_quantity: "1E+2" })))
      .toMatchObject({ success: true, data: { data: { weight: 100, cost: { quantity: 100 } } } });
  });

  it("requires complete cost and bounds every text control", () => {
    expect(mapHomebrewItemFormData(form({ cost_unit: "" }))).toMatchObject({ success: false, fieldErrors: { cost_unit: [expect.any(String)] } });
    expect(mapHomebrewItemFormData(form({ cost_quantity: "" }))).toMatchObject({ success: false, fieldErrors: { cost_quantity: [expect.any(String)] } });
    expect(mapHomebrewItemFormData(form({ name: "x".repeat(101), equipment_category: "x".repeat(101),
      description: "x".repeat(20_001), cost_unit: "x".repeat(21) }))).toMatchObject({ success: false,
      fieldErrors: { name: [expect.any(String)], equipment_category: [expect.any(String)], description: [expect.any(String)], cost_unit: [expect.any(String)] } });
  });

  it("ignores forged authority, identity, raw payload, and effects", () => {
    expect(mapHomebrewItemFormData(form({ owner_id: "attacker", scope: "shared", source: "srd", system_id: "attacker-system",
      content_type: "magic_item", version: "99", effects: '[{"type":"grant"}]', data: '{"weight":99}' }))).toEqual(mapHomebrewItemFormData(form()));
  });
});
