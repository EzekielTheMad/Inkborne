import { describe, expect, it } from "vitest";
import { homebrewTraitVersionSchema, inspectTraitResourceEditability, mapHomebrewTraitFormData, overlayTraitResourceControls } from "@/lib/homebrew/trait-form";

function form(values: Record<string, string | undefined> = {}) {
  const input = new FormData();
  for (const [key, value] of Object.entries({ name: "Lantern memory", description: "An original synthetic recollection.", usages: "", recovery: "", ...values })) if (value !== undefined) input.set(key, value);
  return input;
}
describe("bounded standalone trait controls", () => {
  it("maps passive, explicit zero and safe integer rest counters", () => {
    expect(mapHomebrewTraitFormData(form(), true)).toMatchObject({ success: true, data: { resource: { usages: undefined, recovery: null } } });
    expect(mapHomebrewTraitFormData(form({ usages: "0" }), true)).toMatchObject({ success: true, data: { resource: { usages: 0, recovery: null } } });
    expect(mapHomebrewTraitFormData(form({ usages: Number.MAX_SAFE_INTEGER.toString(), recovery: "short rest" }), true)).toMatchObject({ success: true, data: { resource: { usages: Number.MAX_SAFE_INTEGER, recovery: "short rest" } } });
  });
  it.each(["-1", "0x10", "1e3", "1.5", "NaN", "Infinity", "9007199254740992", "+2"])("rejects unsupported uses %s", value => {
    expect(mapHomebrewTraitFormData(form({ usages: value, recovery: "long rest" }), true)).toMatchObject({ success: false, fieldErrors: { usages: expect.any(Array) } });
  });
  it.each([{ usages: "", recovery: "short rest" }, { usages: "2", recovery: "" }, { usages: "2", recovery: "dawn" }, { usages: "2", recovery: "day" }])("rejects unsupported/incoherent pair %j", values => {
    expect(mapHomebrewTraitFormData(form(values), true).success).toBe(false);
  });
  it("requires finite text controls and rejects duplicate/File scalars", () => {
    for (const values of [{ name: " " }, { description: " " }, { name: "x".repeat(101) }, { description: "x".repeat(20_001) }]) expect(mapHomebrewTraitFormData(form(values), true).success).toBe(false);
    const duplicate = form(); duplicate.append("usages", "2");
    expect(mapHomebrewTraitFormData(duplicate, true).success).toBe(false);
    const file = form(); file.set("description", new File(["not scalar text"], "description.txt"));
    expect(mapHomebrewTraitFormData(file, true).success).toBe(false);
  });
  it("ignores locked/forged resource, authority, extension and relation inputs", () => {
    const input = form({ usages: "999", recovery: "dawn", resourceEditable: "true", effects: "[]", data: "{}", races: "[]", extraLimitedFeatures: "[]", owner_id: "forged" });
    expect(mapHomebrewTraitFormData(input, false)).toEqual({ success: true, data: { name: "Lantern memory", description: "An original synthetic recollection." } });
  });
  it.each<{ usages?: number; recovery?: "long rest" | null }>([{}, { recovery: null }, { usages: 0 }, { usages: 0, recovery: null }, { usages: 2, recovery: "long rest" }])("preserves raw unchanged pair %j", raw => {
    expect(inspectTraitResourceEditability(raw)).toBe(true);
    expect(overlayTraitResourceControls(raw, { usages: raw.usages, recovery: (raw.recovery ?? null) as "long rest" | null })).toEqual(raw);
  });
  it("separates explicit clear/zero from unchanged absence and retains nested extras", () => {
    const extras = { custom: { remembered: ["first", "second"] } };
    expect(overlayTraitResourceControls({ ...extras, usages: 2, recovery: "short rest" }, { recovery: null })).toEqual({ ...extras, recovery: null });
    expect(overlayTraitResourceControls(extras, { usages: 0, recovery: null })).toEqual({ ...extras, usages: 0 });
    expect(overlayTraitResourceControls({ ...extras, usages: 0 }, { recovery: null })).toEqual(extras);
  });
  it.each([{ usages: [1, 2], recovery: "short rest" }, { usages: 2, recovery: "dawn" }, { usages: 2, recovery: "day" }, { usages: -1, recovery: "long rest" }, { usages: 1.5, recovery: "long rest" }, { usages: 2 }, { recovery: "long rest" }])("locks unsupported raw primary resource %j", raw => {
    expect(inspectTraitResourceEditability(raw)).toBe(false);
  });
  it("bounds version independently to actual PostgreSQL integer", () => {
    for (const value of [1, 2_147_483_647]) expect(homebrewTraitVersionSchema.safeParse(value).success).toBe(true);
    for (const value of [0, 1.5, 2_147_483_648, Number.MAX_SAFE_INTEGER, NaN, Infinity]) expect(homebrewTraitVersionSchema.safeParse(value).success).toBe(false);
  });
});
