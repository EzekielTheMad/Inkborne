import { describe, expect, it } from "vitest";
import { acceptFeatureActionResponse, FEATURE_TRANSPORT_MAX_BYTES, FEATURE_VERSION_MAX, mapPassiveFeatureCreate, mapPassiveFeatureEdit } from "@/lib/homebrew/passive-feature-form";
import { passiveFeatureCreateForm, passiveFeatureData, passiveFeatureEditForm, passiveFeatureId } from "@/tests/fixtures/passive-features";

describe("finite private passive feature controls", () => {
  it("retains original text and maps blank subclass to explicit null", () => {
    expect(mapPassiveFeatureCreate(passiveFeatureCreateForm())).toEqual({ success: true, data: { name: "Lantern Cadence", description: passiveFeatureData.description, class: "workshop-scout", subclass: null, level: 3 } });
    const form = passiveFeatureCreateForm(); form.set("subclass", "original-lantern-hand"); expect(mapPassiveFeatureCreate(form)).toMatchObject({ success: true, data: { subclass: "original-lantern-hand" } });
  });
  it.each(["name", "description", "class", "subclass", "level"])("rejects missing, repeated and file-valued create %s", key => {
    const missing = passiveFeatureCreateForm(); missing.delete(key); expect(mapPassiveFeatureCreate(missing).success).toBe(false);
    const duplicate = passiveFeatureCreateForm(); duplicate.append(key, String(duplicate.get(key))); expect(mapPassiveFeatureCreate(duplicate).success).toBe(false);
    const file = passiveFeatureCreateForm(); file.set(key, new File(["Original fixture"], "original.txt")); expect(mapPassiveFeatureCreate(file).success).toBe(false);
  });
  it.each(["name", "description", "id", "expected_version"])("rejects missing, repeated and file-valued edit %s", key => {
    const missing = passiveFeatureEditForm(); missing.delete(key); expect(mapPassiveFeatureEdit(missing).success).toBe(false);
    const duplicate = passiveFeatureEditForm(); duplicate.append(key, String(duplicate.get(key))); expect(mapPassiveFeatureEdit(duplicate).success).toBe(false);
    const file = passiveFeatureEditForm(); file.set(key, new File(["Original fixture"], "original.txt")); expect(mapPassiveFeatureEdit(file).success).toBe(false);
  });
  it.each(["owner_id", "system_id", "content_type", "source", "scope", "effects", "feature_type", "choices", "character_id", "class_id", "relations"])("rejects extra authority/mechanics %s", key => {
    const create = passiveFeatureCreateForm(); create.set(key, "forged"); expect(mapPassiveFeatureCreate(create).success).toBe(false);
    const edit = passiveFeatureEditForm(); edit.set(key, "forged"); expect(mapPassiveFeatureEdit(edit).success).toBe(false);
  });
  it.each(["class", "subclass", "level"])("rejects association edits %s", key => {
    const form = passiveFeatureEditForm(); form.set(key, "forged"); expect(mapPassiveFeatureEdit(form).success).toBe(false);
  });
  it.each(["", "  ", "Uppercase", "with spaces", "two--hyphens", "-leading", "trailing-", "é", "a".repeat(101)])("rejects new class slug %s", value => {
    const form = passiveFeatureCreateForm(); form.set("class", value); expect(mapPassiveFeatureCreate(form).success).toBe(false);
  });
  it.each(["0", "21", "-1", "01", "1.5", "1e1", "Infinity", "", "[1,2]"])("rejects gain level %s without allocating mechanics", value => {
    const form = passiveFeatureCreateForm(); form.set("level", value); expect(mapPassiveFeatureCreate(form).success).toBe(false);
  });
  it.each(["0", "01", "-1", "1.2", "1e2", "2147483648", "Infinity"])("rejects version %s", value => {
    const form = passiveFeatureEditForm(); form.set("expected_version", value); expect(mapPassiveFeatureEdit(form).success).toBe(false);
  });
  it("accepts frozen text/version bounds with exact whitespace and UTF8, rejects nonblank/overflow", () => {
    const form = passiveFeatureCreateForm(); form.set("name", "é".repeat(100)); form.set("description", "界".repeat(20_000)); form.set("class", "a".repeat(100)); form.set("level", "20");
    expect(mapPassiveFeatureCreate(form).success).toBe(true);
    form.set("description", "界".repeat(20_001)); expect(mapPassiveFeatureCreate(form).success).toBe(false);
    form.set("description", "   "); expect(mapPassiveFeatureCreate(form).success).toBe(false);
    const edit = passiveFeatureEditForm(FEATURE_VERSION_MAX); expect(mapPassiveFeatureEdit(edit)).toMatchObject({ success: true, data: { expected_version: FEATURE_VERSION_MAX } });
    edit.set("id", "foreign-id"); expect(mapPassiveFeatureEdit(edit).success).toBe(false);
  });
  it.each([131_071, 131_072, 131_073])("counts cumulative transport before field parsing at %i UTF8 bytes", bytes => {
    const form = passiveFeatureCreateForm(); const otherBytes = [...form.entries()].filter(([key]) => key !== "description").reduce((sum, [, value]) => sum + new TextEncoder().encode(String(value)).length, 0);
    const text = "界".repeat(Math.floor((bytes - otherBytes) / 3)) + "x".repeat((bytes - otherBytes) % 3); form.set("description", text);
    expect(new TextEncoder().encode(String(form.get("description"))).length).toBeLessThan(FEATURE_TRANSPORT_MAX_BYTES);
    const parsed = mapPassiveFeatureCreate(form); expect(parsed.success).toBe(false); // Description character cap also applies.
    if (!parsed.success) expect(Object.hasOwn(parsed.fieldErrors, "form")).toBe(bytes > FEATURE_TRANSPORT_MAX_BYTES);
  });
  it("permits only framework action metadata outside named fields", () => {
    const form = passiveFeatureCreateForm(); form.set("$ACTION_ID_original", "framework fixture"); expect(mapPassiveFeatureCreate(form).success).toBe(true);
  });
});
describe("feature client response correspondence", () => {
  const expected = { id: passiveFeatureId, version: 1 };
  it("admits confirmed create/next-version edit and exact unchanged version", () => {
    expect(acceptFeatureActionResponse({ status: "saved", id: passiveFeatureId, version: 1, operation: "create" }, "create")).toMatchObject({ status: "saved" });
    expect(acceptFeatureActionResponse({ status: "saved", id: passiveFeatureId, version: 2, operation: "edit" }, "edit", expected)).toMatchObject({ status: "saved" });
    expect(acceptFeatureActionResponse({ status: "unchanged", id: passiveFeatureId, version: 1, message: "No changes to save." }, "edit", expected)).toMatchObject({ status: "unchanged" });
  });
  it.each([{ value: undefined }, { value: null }, { value: { status: "idle" } }, { value: { status: "error" } }, { value: { status: "error", message: "bad", fieldErrors: { name: "bad" } } },
    { value: { status: "saved", id: "bad", version: 1, operation: "create" } }, { value: { status: "saved", id: passiveFeatureId, version: 2, operation: "create" } }])("treats missing/malformed create as uncertainty $value", ({ value }) => {
    expect(acceptFeatureActionResponse(value, "create")).toMatchObject({ status: "uncertain" });
  });
  it("refuses wrong edit identity/old version/operation and unexpected create no-op", () => {
    for (const value of [{ status: "saved", id: passiveFeatureId, version: 1, operation: "edit" },
      { status: "saved", id: "44444444-4444-4444-8444-444444444444", version: 2, operation: "edit" },
      { status: "saved", id: passiveFeatureId, version: 2, operation: "create" }]) expect(acceptFeatureActionResponse(value, "edit", expected)).toMatchObject({ status: "uncertain" });
    expect(acceptFeatureActionResponse({ status: "unchanged", id: passiveFeatureId, version: 1, message: "No changes to save." }, "create")).toMatchObject({ status: "uncertain" });
  });
});
