import { describe, expect, it } from "vitest";
import { MONSTER_CONTROLS, monsterDataToDraft, monsterDraftToData, type MonsterDraftObject, type MonsterDraftRow } from "@/lib/homebrew/monster-draft";
import { changedMonsterFields, mapHomebrewMonsterFormData, mergeMonsterEdit, MONSTER_EDITABLE_FIELDS, MONSTER_TRANSPORT_MAX_BYTES, monsterJsonEqual } from "@/lib/homebrew/monster-form";
import { monsterDataSchema } from "@/lib/schemas/content-types/monster";
import { cinderlitKite, glassrootSentinel, lanternReefRegent, monsterWithBytes } from "@/tests/fixtures/monsters";

const ID = "33333333-3333-4333-8333-333333333333";
function form(mode: "create" | "edit" = "create", data: unknown = cinderlitKite) {
  const result = new FormData(); result.set("name", "Original Lantern"); result.set("monster_data", JSON.stringify(data));
  if (mode === "edit") { result.set("id", ID); result.set("expected_version", "1"); result.set("changed_fields", "[]"); }
  return result;
}
describe("monster structured draft and bounded transport", () => {
  it.each([cinderlitKite, glassrootSentinel, lanternReefRegent, monsterWithBytes(62_138)])("round trips canonical original content, order, absence and declared values", (data) => {
    expect(monsterDraftToData(monsterDataToDraft(data))).toEqual(data);
  });
  it("covers every editable v1 group without guessed required defaults", () => {
    expect(Object.keys(MONSTER_CONTROLS)).toEqual([...MONSTER_EDITABLE_FIELDS]);
    const data = monsterDraftToData(monsterDataToDraft());
    expect(data).toMatchObject({ schema_version: 1, size: "", creature_type: "", armor_class: { value: "" }, hit_points: { average: "" }, ability_scores: { strength: "" } });
    expect(data).not.toHaveProperty("saving_throws"); expect(monsterDataSchema.safeParse(data).success).toBe(false);
  });
  it.each(["", "1.5", "1e1", "NaN", "Infinity", " 10", "9007199254740992"])("refuses required numeric syntax %s", (value) => {
    const draft = monsterDataToDraft(cinderlitKite); (draft.ability_scores as MonsterDraftObject).strength = value;
    expect(monsterDataSchema.safeParse(monsterDraftToData(draft)).success).toBe(false);
  });
  it("keeps zero, negative, explicit empty arrays and optional blanks distinct", () => {
    const draft = monsterDataToDraft({ ...cinderlitKite, languages: [] });
    (draft.speed as MonsterDraftObject).fly = "0"; (draft.saving_throws as MonsterDraftObject).strength = "-2";
    (draft.speed as MonsterDraftObject).notes = "";
    expect(monsterDraftToData(draft)).toMatchObject({ speed: { fly: 0, walk: 0 }, saving_throws: { strength: -2 }, languages: [] });
    expect(monsterDraftToData(draft).speed).not.toHaveProperty("notes");
  });
  it("row IDs never enter data; equal named ordered entries are preserved", () => {
    const draft = monsterDataToDraft({ ...cinderlitKite, traits: [{ name: "Echo", description: "First." }, { name: "Echo", description: "Second." }] });
    const rows = draft.traits as MonsterDraftRow[]; rows.reverse();
    expect(monsterDraftToData(draft).traits).toEqual([{ name: "Echo", description: "Second." }, { name: "Echo", description: "First." }]);
    expect(JSON.stringify(monsterDraftToData(draft))).not.toContain("traits-0");
  });
  it.each([131_071, 131_072, 131_073])("counts cumulative UTF8 controls at %i before parsing", (bytes) => {
    const input = form("edit"); input.set("name", "é".repeat(40));
    const existing = [...input.values()].reduce((sum, value) => sum + new TextEncoder().encode(String(value)).length, 0);
    input.set("monster_data", input.get("monster_data") + " ".repeat(bytes - existing));
    expect(new TextEncoder().encode(String(input.get("monster_data"))).length).toBeLessThan(MONSTER_TRANSPORT_MAX_BYTES);
    const result = mapHomebrewMonsterFormData(input, "edit");
    expect(result.success).toBe(bytes <= MONSTER_TRANSPORT_MAX_BYTES);
    if (!result.success) expect(result.fieldErrors).toHaveProperty("form");
  });
  it.each([65_536, 65_537])("independently enforces decoded UTF8 data budget %i", (bytes) => {
    expect(mapHomebrewMonsterFormData(form("create", monsterWithBytes(bytes)), "create").success).toBe(bytes <= 65_536);
  });
  it.each(["name", "monster_data", "changed_fields", "id", "expected_version"])("refuses duplicate and File %s", (key) => {
    const duplicate = form("edit"); duplicate.append(key, String(duplicate.get(key)));
    expect(mapHomebrewMonsterFormData(duplicate, "edit").success).toBe(false);
    const file = form("edit"); file.set(key, new File(["x"], "fixture.txt"));
    expect(mapHomebrewMonsterFormData(file, "edit").success).toBe(false);
  });
  it.each(["0", "-1", "01", "1e2", "1.1", "2147483648", "Infinity"])("refuses version %s", (version) => {
    const input = form("edit"); input.set("expected_version", version); expect(mapHomebrewMonsterFormData(input, "edit").success).toBe(false);
  });
  it("admits the PostgreSQL version ceiling and ignores external authority claims", () => {
    const input = form("edit"); input.set("expected_version", "2147483647"); input.set("owner_id", "foreign"); input.set("effects", "[]");
    expect(mapHomebrewMonsterFormData(input, "edit")).toMatchObject({ success: true, value: { id: ID, expectedVersion: 2147483647 } });
  });
  it.each(["bad JSON", '["actions","actions"]', '["schema_version"]', '["effects"]', '["owner_id"]', '["unknown"]'])("refuses malformed/tampered intent %s", (intent) => {
    const input = form("edit"); input.set("changed_fields", intent); expect(mapHomebrewMonsterFormData(input, "edit").success).toBe(false);
  });
  it.each([{ ...cinderlitKite, schema_version: 2 }, { ...cinderlitKite, extension: true }, { ...cinderlitKite, armor_class: { value: 12, script: "x" } }])("refuses unsupported formats/extensions without stripping", (data) => {
    expect(() => monsterDataToDraft(data)).toThrow(); expect(mapHomebrewMonsterFormData(form("create", data), "create").success).toBe(false);
  });
  it("refuses missing required controls, invalid identity and broken JSON", () => {
    const input = form("edit"); input.delete("name"); expect(mapHomebrewMonsterFormData(input, "edit").success).toBe(false);
    input.set("name", "Original"); input.set("id", "foreign-id"); expect(mapHomebrewMonsterFormData(input, "edit").success).toBe(false);
    input.set("id", ID); input.set("monster_data", "{"); expect(mapHomebrewMonsterFormData(input, "edit").success).toBe(false);
  });
});
describe("raw-preserving monster edit intent", () => {
  it("keeps untouched raw groups by reference and original text, absent/empty distinctions", () => {
    const before = { ...cinderlitKite, languages: [], description: "  Original text.  " };
    const draft = { ...before, creature_type: "lantern construct" };
    const merged = mergeMonsterEdit(before, draft, ["creature_type"]);
    expect(merged.armor_class).toBe(before.armor_class); expect(merged.actions).toBe(before.actions);
    expect(merged.description).toBe("  Original text.  "); expect(merged.languages).toEqual([]); expect(merged).not.toHaveProperty("skills");
    expect(changedMonsterFields(before, draft)).toEqual(["creature_type"]);
  });
  it("allows explicit optional clear but rejects undeclared changes, required clear, invalid and duplicated intent", () => {
    const { description: _description, ...cleared } = cinderlitKite;
    expect(mergeMonsterEdit(cinderlitKite, cleared, ["description"])).not.toHaveProperty("description");
    expect(() => mergeMonsterEdit(cinderlitKite, cleared, [])).toThrow();
    expect(() => mergeMonsterEdit(cinderlitKite, { ...cinderlitKite, speed: {} }, ["speed"])).toThrow();
    expect(() => mergeMonsterEdit(cinderlitKite, cinderlitKite, ["actions", "actions"])).toThrow();
  });
  it("object key order is insignificant while array order and no-op intent are significant", () => {
    expect(monsterJsonEqual({ x: 1, y: [1, 2] }, { y: [1, 2], x: 1 })).toBe(true);
    expect(monsterJsonEqual({ x: [1, 2] }, { x: [2, 1] })).toBe(false);
    expect(mergeMonsterEdit(cinderlitKite, cinderlitKite, ["description"])).toEqual(cinderlitKite);
  });
});
