import { describe, expect, it } from "vitest";

import { acceptMagicItemResponse, magicItemActionStateSchema, mapHomebrewMagicItemFormData, mapMagicItemEditIdentity, mergeMagicItemEdit } from "@/lib/homebrew/magic-item-form";

function form(overrides: Record<string, string> = {}): FormData {
  const input = new FormData();
  input.set("name", "  Oathbound Compass  ");
  input.set("rarity", "Rare");
  input.set(
    "description",
    "  A compass that points toward the last promise you made.  ",
  );
  input.set("equipment_category", "  Wondrous item  ");
  input.set("requires_attunement", "on");
  for (const [key, value] of Object.entries(overrides)) input.set(key, value);
  return input;
}

describe("mapHomebrewMagicItemFormData", () => {
  it("maps trimmed named controls into canonical magic-item data", () => {
    expect(mapHomebrewMagicItemFormData(form())).toEqual({
      success: true,
      data: {
        name: "Oathbound Compass",
        data: {
          rarity: "Rare",
          description: "A compass that points toward the last promise you made.",
          equipment_category: "Wondrous item",
          requires_attunement: true,
        },
      },
    });
  });

  it("omits an empty optional category and treats an absent checkbox as false", () => {
    const input = form({ equipment_category: "" });
    input.delete("requires_attunement");

    expect(mapHomebrewMagicItemFormData(input)).toEqual({
      success: true,
      data: {
        name: "Oathbound Compass",
        data: {
          rarity: "Rare",
          description: "A compass that points toward the last promise you made.",
          requires_attunement: false,
        },
      },
    });
  });

  it("returns named validation errors and ignores forged envelope fields", () => {
    const invalid = form({ name: "", rarity: "Mythic", description: "" });
    invalid.set("owner_id", "attacker");
    invalid.set("content_type", "spell");
    invalid.set("effects", '[{"type":"grant"}]');

    expect(mapHomebrewMagicItemFormData(invalid)).toEqual({
      success: false,
      fieldErrors: {
        name: ["Name is required."],
        rarity: [expect.any(String)],
        description: ["Description is required."],
      },
    });
  });
});

describe("finite magic-item input and acknowledgment", () => {
  const id = "33333333-3333-4333-8333-333333333333";
  it.each(["name", "rarity", "description", "equipment_category", "requires_attunement"])("rejects duplicate or File %s rather than coercing first value", key => {
    const duplicate = form(); duplicate.append(key, String(duplicate.get(key))); expect(mapHomebrewMagicItemFormData(duplicate).success).toBe(false);
    const file = form(); file.set(key, new File(["Synthetic content"], "fixture.txt")); expect(mapHomebrewMagicItemFormData(file).success).toBe(false);
  });
  it("unknown checkbox syntax refuses but hidden authority/extras remain ignored", () => {
    expect(mapHomebrewMagicItemFormData(form({ requires_attunement: "arbitrary" })).success).toBe(false);
    const hidden = form(); hidden.set("data", "forged"); hidden.set("source_refs", "forged"); hidden.set("scope", "shared"); hidden.set("effects", "forged");
    expect(mapHomebrewMagicItemFormData(hidden)).toEqual(mapHomebrewMagicItemFormData(form()));
  });
  it.each(["0", "01", "1.0", "1e0", "0x1", "NaN", "Infinity", " 1", "2147483648"])("strict expected_version %s is not accepted", version => {
    const f = form({ id, expected_version: version }); expect(mapMagicItemEditIdentity(f)).toBeNull();
  });
  it("accepts pg version endpoints only once; File/duplicate identities refuse", () => {
    const f = form({ id, expected_version: "2147483647" }); expect(mapMagicItemEditIdentity(f)).toEqual({ id, expectedVersion: 2147483647 });
    f.set("expected_version", "1"); expect(mapMagicItemEditIdentity(f)).toEqual({ id, expectedVersion: 1 });
    f.append("id", id); expect(mapMagicItemEditIdentity(f)).toBeNull(); f.set("id", new File(["identity"], "id.txt")); expect(mapMagicItemEditIdentity(f)).toBeNull();
  });
  it.each([undefined, null, { status: "idle", message: "Unexpected idle" }, { id }, { status: "saved", id, version: 2, operation: "create" },
    { status: "saved", id, version: 1, operation: "create", owner: id }])("malformed/action-returned idle/wrong create%j becomes uncertain", raw => {
    expect(acceptMagicItemResponse(raw, "create")).toMatchObject({ status: "uncertain" });
  });
  it("correlates saved/unchanged to mounted id/version/mode without authority inference", () => {
    const saved = { status: "saved", operation: "edit", id, version: 2 }; expect(acceptMagicItemResponse(saved, "edit", id, 1)).toEqual(saved);
    expect(acceptMagicItemResponse({ ...saved, version: 1 }, "edit", id, 1)).toMatchObject({ status: "uncertain" });
    expect(acceptMagicItemResponse(saved, "edit", "44444444-4444-4444-8444-444444444444", 1)).toMatchObject({ status: "uncertain" });
    expect(acceptMagicItemResponse(saved, "edit", id, 2147483647)).toMatchObject({ status: "uncertain" });
    const unchanged = { status: "unchanged", id, version: 1, message: "This invocation did not write." };
    expect(acceptMagicItemResponse(unchanged, "edit", id, 1)).toEqual(unchanged); expect(acceptMagicItemResponse(unchanged, "create")).toMatchObject({ status: "uncertain" });
  });
  it("feedback is strict and bounded across the whole response", () => {
    const feedback = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`field${i}`, ["x".repeat(200), "Second", "Third"]]));
    expect(magicItemActionStateSchema.safeParse({ status: "error", message: "x".repeat(1000), fieldErrors: feedback }).success).toBe(true);
    expect(magicItemActionStateSchema.safeParse({ status: "error", message: "OK", fieldErrors: { ...feedback, extra: ["Extra"] } }).success).toBe(false);
    expect(acceptMagicItemResponse({ status: "error", message: "OK", fieldErrors: { name: ["a", "b", "c", "d"] } }, "create")).toMatchObject({ status: "uncertain" });
    expect(acceptMagicItemResponse({ status: "error", message: "x".repeat(1001) }, "create")).toMatchObject({ status: "uncertain" });
  });
});

describe("validation-only raw magic-item merge", () => {
  it("semantic unchanged controls retain raw absent defaults and whitespace", () => {
    const raw = { description: "  Original description.  ", custom: { nested: [null, 0, 0] } };
    const merged = mergeMagicItemEdit("  Original Compass  ", raw, { name: "Original Compass", data: { rarity: "Common", description: "Original description.", requires_attunement: false } });
    expect(merged).toEqual({ name: "  Original Compass  ", data: raw }); expect(merged.data).not.toHaveProperty("rarity"); expect(merged.data).not.toHaveProperty("requires_attunement"); expect(merged.data).not.toHaveProperty("equipment_category");
  });
  it("only changed controls overlay; blank category clears that key and raw extension keys survive", () => {
    const raw = JSON.parse('{"rarity":"Rare","description":"Original description.","equipment_category":" Wondrous item ","requires_attunement":true,"custom":{"order":[2,2,1]},"__proto__":{"keep":true}}') as Record<string, unknown>;
    const merged = mergeMagicItemEdit("Original Compass", raw, { name: "Changed Compass", data: { rarity: "Rare", description: "Changed description.", requires_attunement: true } });
    expect(merged.name).toBe("Changed Compass"); expect(merged.data).not.toHaveProperty("equipment_category"); expect(merged.data.description).toBe("Changed description."); expect(merged.data.custom).toEqual(raw.custom);
    expect(Object.hasOwn(merged.data, "__proto__")).toBe(true); expect(Object.getPrototypeOf(merged.data)).toBe(Object.prototype);
    expect(raw.equipment_category).toBe(" Wondrous item "); expect(raw.description).toBe("Original description.");
  });
  it("over-limit original controls are refused, never silently truncated", () => {
    expect(() => mergeMagicItemEdit("x".repeat(101), { description: "Original" }, { name: "Changed", data: { rarity: "Common", description: "Changed", requires_attunement: false } })).toThrow();
    expect(() => mergeMagicItemEdit("Original", { description: "x".repeat(20001) }, { name: "Original", data: { rarity: "Common", description: "Changed", requires_attunement: false } })).toThrow();
  });
});
