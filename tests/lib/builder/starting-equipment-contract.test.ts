import { describe, expect, it } from "vitest";
import { buildInventoryGrants, parseEquipmentGroups } from "@/lib/builder/equipment-choices";
import { equipmentRequestSchema, equipmentRequestIntent, equipmentPlanSchema, equalEquipmentIntent } from "@/lib/builder/starting-equipment-contract";
const request = {
  characterId: "11111111-1111-4111-8111-111111111111",
  selections: { selections: { "class:0": "a" }, picks: {} },
  sources: { class: { id: "22222222-2222-4222-8222-222222222222", version: 1 }, background: null },
};
describe("starting equipment boundary contract (no database proof)", () => {
  it("accepts saved maps and exact source versions, ignoring only the completion flag in replay intent", () => {
    const parsed = equipmentRequestSchema.parse(request);
    expect(equipmentRequestIntent(parsed)).toEqual(equipmentRequestIntent({ ...parsed, selections: { ...parsed.selections, confirmed: true } }));
  });
  it.each([null, [], { selections: [] , picks: {} }, { selections: { one: 1 }, picks: {} }, { selections: {}, picks: null }, { selections: {}, picks: {}, award: 500 }])("rejects malformed selections %j", selections => {
    expect(equipmentRequestSchema.safeParse({ ...request, selections }).success).toBe(false);
  });
  it("rejects browser actor/award fields, missing class and invalid versions", () => {
    expect(equipmentRequestSchema.safeParse({ ...request, actorId: request.characterId }).success).toBe(false);
    expect(equipmentRequestSchema.safeParse({ ...request, items: [] }).success).toBe(false);
    expect(equipmentRequestSchema.safeParse({ ...request, sources: { class: null, background: null } }).success).toBe(false);
    expect(equipmentRequestSchema.safeParse({ ...request, sources: { class: { ...request.sources.class, version: 0 }, background: null } }).success).toBe(false);
  });
  it("bounds the maps and strings before parser work", () => {
    const tooMany = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [String(i), "a"]));
    expect(equipmentRequestSchema.safeParse({ ...request, selections: { selections: tooMany, picks: {} } }).success).toBe(false);
    expect(equipmentRequestSchema.safeParse({ ...request, selections: { selections: {}, picks: { one: "x".repeat(301) } } }).success).toBe(false);
  });
  it("validates output of the established parser, retaining custom items and currency", () => {
    const groups = parseEquipmentGroups({ classText: "A mace", backgroundText: "Vestments, and a pouch containing 15 gp" });
    const plan = buildInventoryGrants(groups, { selections: {}, picks: {} }, [{ id: request.sources.class.id, version: 3, name: "Mace", slug: "mace", content_type: "weapon" }]);
    expect(equipmentPlanSchema.parse(plan)).toEqual(plan);
    expect(plan.items).toEqual(expect.arrayContaining([expect.objectContaining({ content_id: request.sources.class.id, content_version: 3 }), expect.objectContaining({ content_id: null, name: "Vestments" })]));
    expect(plan.currency).toEqual({ gp: 15 });
  });
  it.each([-1, 0, 1.5, Infinity, 10001])("rejects invalid item quantity %s", quantity => {
    expect(equipmentPlanSchema.safeParse({ items: [{ content_id: null, content_version: null, name: "Rope", content_type: "item", quantity }], currency: {} }).success).toBe(false);
  });
  it("rejects mismatched pins and unsafe currency plans", () => {
    expect(equipmentPlanSchema.safeParse({ items: [{ content_id: request.sources.class.id, content_version: null, name: "Mace", content_type: "weapon", quantity: 1 }], currency: {} }).success).toBe(false);
    for (const currency of [{ gp: -1 }, { gp: 1.5 }, { gp: 1000001 }, { platinum: 1 }]) expect(equipmentPlanSchema.safeParse({ items: [], currency }).success).toBe(false);
  });
  it("compares equivalent JSON maps without accepting changed selection, source, version or plan", () => {
    expect(equalEquipmentIntent({ picks: { b: "2", a: "1" }, selections: {} }, { selections: {}, picks: { a: "1", b: "2" } })).toBe(true);
    expect(equalEquipmentIntent({ "\u00e9": "one", "e\u0301": "two" }, { "e\u0301": "two", "\u00e9": "one" })).toBe(true);
    const base = equipmentRequestIntent(equipmentRequestSchema.parse(request));
    expect(equalEquipmentIntent(base, { ...base, selections: { ...base.selections, selections: { "class:0": "b" } } })).toBe(false);
    expect(equalEquipmentIntent(base, { ...base, sources: { ...base.sources, class: { ...base.sources.class, version: 2 } } })).toBe(false);
    expect(equalEquipmentIntent({ items: ["a", "b"] }, { items: ["b", "a"] })).toBe(false);
  });
});
