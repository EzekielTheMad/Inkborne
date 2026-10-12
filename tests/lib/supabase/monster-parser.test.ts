import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseContentDefinition, parseContentDefinitions, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { cinderlitKite, monsterEnvelope } from "@/tests/fixtures/monsters";

function snapshot(row: ReturnType<typeof monsterEnvelope>) {
  return {
    content_id: row.id, version: row.version, system_id_snapshot: row.system_id,
    content_type_snapshot: row.content_type, slug_snapshot: row.slug, name_snapshot: row.name,
    data_snapshot: row.data, effects_snapshot: row.effects, source_snapshot: row.source,
    scope_snapshot: row.scope, owner_id_snapshot: row.owner_id,
  };
}

describe("monster canonical envelopes (pure parsing, no authorization proof)", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  it("parses personal, platform and returned shared fixtures through the real canonical parser", () => {
    const personal = monsterEnvelope();
    const platform = { ...personal, source: "srd", scope: "platform", owner_id: null };
    const shared = { ...personal, scope: "shared", owner_id: "44444444-4444-4444-8444-444444444444" };
    expect(parseContentDefinitions([personal, platform, shared])).toMatchObject([
      { content_type: "monster", scope: "personal", data: cinderlitKite },
      { content_type: "monster", source: "srd", scope: "platform", owner_id: null },
      { content_type: "monster", scope: "shared", owner_id: shared.owner_id },
    ]);
  });
  it("omits only malformed payload rows and rejects mismatched type/ID/source/effects", () => {
    const row = monsterEnvelope();
    expect(parseContentDefinitions([row, { ...row, data: { ...row.data, schema_version: 2 } }, row])).toHaveLength(2);
    for (const invalid of [
      { ...row, id: "not-a-uuid" }, { ...row, source: "copied-book" }, { ...row, effects: [{ type: "execute" }] },
      { ...row, content_type: "spell" }, { ...row, content_type: "unknown" },
      { ...row, data: { ...row.data, formula: "return 100" } },
    ]) expect(parseContentDefinition(invalid)).toBeNull();
  });
  it("keeps immutable v1 snapshot identity/data when a distinct current v2 differs", () => {
    const v1 = monsterEnvelope();
    const pinned = snapshot(v1);
    const parent = { ...v1, version: 2, name: "Rebuilt Kite", data: { ...v1.data, hit_points: { average: 99 } } };
    expect(parseContentDefinition(parent)).toMatchObject({ name: "Rebuilt Kite", version: 2, data: { hit_points: { average: 99 } } });
    expect(parseContentVersionSnapshot(pinned)).toEqual(parseContentDefinition(v1));
    expect(parseContentVersionSnapshot(pinned)).toMatchObject({
      id: v1.id, system_id: v1.system_id, content_type: "monster", slug: v1.slug,
      name: "Cinderlit Kite", version: 1, source: "homebrew", scope: "personal", owner_id: v1.owner_id,
      data: { schema_version: 1, hit_points: { average: 18, dice_text: "3d6 + 8" } }, effects: [],
    });
    expect(parseContentDefinition({ ...v1, version: 9 })?.data.schema_version).toBe(1);
    expect(parseContentVersionSnapshot({ ...pinned, data_snapshot: { ...v1.data, schema_version: 9 } })).toBeNull();
    expect(parseContentVersionSnapshot({ ...pinned, system_id_snapshot: "invalid" })).toBeNull();
  });
  it("retains valid envelope effects without injecting them into monster statistics", () => {
    const row = { ...monsterEnvelope(), effects: [{ type: "mechanical", stat: "armor_class", op: "add", value: 99 }] };
    const parsed = parseContentDefinition(row);
    expect(parsed?.effects).toEqual(row.effects);
    expect(parsed?.data.armor_class).toEqual({ value: 12, notes: "woven shell" });
  });
});
