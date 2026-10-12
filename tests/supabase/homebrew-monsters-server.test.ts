import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { createHomebrewMonsterRecord, getOwnedHomebrewMonster, listOwnedHomebrewMonsters, updateHomebrewMonsterRecord } from "@/lib/supabase/homebrew-monsters-server";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { cinderlitKite } from "@/tests/fixtures/monsters";

const OWNER = "11111111-1111-4111-8111-111111111111", SYSTEM = "22222222-2222-4222-8222-222222222222", ID = "33333333-3333-4333-8333-333333333333";
type Reply = { data: unknown; error: { code?: string } | null };
type Call = { table: string; operation: string; payload?: unknown; filters: [string, unknown][]; single?: string };
const ok = (data: unknown): Reply => ({ data, error: null });
function database(replies: Reply[], authenticated = true) {
  const calls: Call[] = [];
  let index = 0;
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: authenticated ? { id: OWNER } : null }, error: null }) },
    from(table: string) {
      const reply = replies[index++] ?? ok(null), call: Call = { table, operation: "select", filters: [] }; calls.push(call);
      const builder = { select: () => builder, order: () => builder,
        eq(key: string, value: unknown) { call.filters.push([key, value]); return builder; },
        insert(payload: unknown) { call.operation = "insert"; call.payload = payload; return builder; },
        update(payload: unknown) { call.operation = "update"; call.payload = payload; return builder; },
        single() { call.single = "single"; return Promise.resolve(reply); },
        maybeSingle() { call.single = "maybeSingle"; return Promise.resolve(reply); },
        then(resolve: (value: Reply) => unknown) { return Promise.resolve(reply).then(resolve); },
      }; return builder;
    },
  }; mocks.createClient.mockResolvedValue(client); return { client, calls };
}
function row(version = 1, overrides: Record<string, unknown> = {}) {
  return { id: ID, system_id: SYSTEM, content_type: "monster", slug: "original-kite", name: "Original Kite", data: cinderlitKite,
    effects: [{ type: "mechanical", stat: "strength", op: "add", value: 1, extraMetadata: { label: "retain me" } }],
    source: "homebrew", scope: "personal", owner_id: OWNER, version, created_at: "2026-10-12T00:00:00Z", is_retired: false, ...overrides };
}
function form(edit = false, data: unknown = cinderlitKite, changed: string[] = [], name = "Original Kite") {
  const input = new FormData(); input.set("name", name); input.set("monster_data", JSON.stringify(data));
  if (edit) { input.set("id", ID); input.set("expected_version", "1"); input.set("changed_fields", JSON.stringify(changed)); }
  return input;
}
const privateFilters: [string, unknown][] = [["owner_id", OWNER], ["system_id", SYSTEM], ["source", "homebrew"], ["content_type", "monster"], ["scope", "personal"], ["is_retired", false]];
beforeEach(() => vi.clearAllMocks());
describe("private monster DAL (mocked query proof only)", () => {
  it("creates a server-derived version-free private envelope and confirms canonical data", async () => {
    const db = database([ok({ id: SYSTEM }), ok(row())]); const input = form();
    for (const key of ["owner_id", "scope", "source", "system_id", "effects", "version", "slug", "content_type"]) input.set(key, "forged");
    expect(await createHomebrewMonsterRecord(input)).toEqual({ id: ID, name: "Original Kite", version: 1, data: cinderlitKite });
    expect(db.calls[0]).toMatchObject({ single: "single", filters: [["slug", "dnd-5e-2014"], ["status", "published"]] });
    expect(db.calls[1].payload).toEqual({ system_id: SYSTEM, content_type: "monster", slug: expect.stringMatching(/^original-kite-[a-f0-9]{8}$/),
      name: "Original Kite", data: cinderlitKite, effects: [], owner_id: OWNER, scope: "personal", source: "homebrew" });
    expect(db.calls.map((call) => call.table)).toEqual(["game_systems", "content_definitions"]);
  });
  it.each([createHomebrewMonsterRecord, updateHomebrewMonsterRecord])("denies missing authentication before reads or mutation", async (operation) => {
    const db = database([], false); expect(await operation(form(true))).toMatchObject({ status: "error" }); expect(db.calls).toEqual([]);
  });
  it("denies invalid transport before system lookup", async () => {
    const db = database([]), input = form(); input.append("name", "other");
    expect(await createHomebrewMonsterRecord(input)).toMatchObject({ status: "error", fieldErrors: { name: expect.any(Array) } }); expect(db.calls).toEqual([]);
  });
  it.each([ok(null), { data: null, error: { code: "PGRST116" } }, ok([{ id: SYSTEM }, { id: SYSTEM }]), ok({ id: "bad" })])("requires one actual published canonical system", async (response) => {
    const db = database([response]); expect(await createHomebrewMonsterRecord(form())).toMatchObject({ status: "error" }); expect(db.calls).toHaveLength(1);
  });
  it("list/get apply owner/system/type/private/active filters and expose only controls", async () => {
    const db = database([ok({ id: SYSTEM }), ok([row()])]);
    expect(await listOwnedHomebrewMonsters()).toEqual([{ id: ID, name: "Original Kite", version: 1, data: cinderlitKite }]);
    expect(db.calls[1].filters).toEqual(privateFilters);
    const get = database([ok({ id: SYSTEM }), ok(row())]);
    expect(await getOwnedHomebrewMonster(ID)).not.toHaveProperty("effects");
    expect(get.calls[1].filters).toEqual([...privateFilters, ["id", ID]]);
  });
  it.each([{ owner_id: SYSTEM }, { system_id: OWNER }, { source: "srd" }, { content_type: "spell" }, { scope: "shared" }, { is_retired: true },
    { data: { ...cinderlitKite, unknown: true } }, { effects: [{ type: "unknown" }] }])("refuses unexpected/unsupported returned rows", async (override) => {
    const db = database([ok({ id: SYSTEM }), ok(row(1, override))]);
    await expect(getOwnedHomebrewMonster(ID)).rejects.toThrow(); expect(db.calls[1].filters).toEqual([...privateFilters, ["id", ID]]);
  });
  it("CAS merges raw unchanged groups and never writes effects/envelope/snapshots", async () => {
    const raw = row(); const edited = { ...cinderlitKite, description: "An original revised description." };
    const db = database([ok({ id: SYSTEM }), ok(raw), ok(row(2, { data: edited }))]);
    expect(await updateHomebrewMonsterRecord(form(true, edited, ["description"]))).toMatchObject({ id: ID, version: 2, data: edited });
    expect(db.calls[1].filters).toEqual([...privateFilters, ["id", ID], ["version", 1]]);
    expect(db.calls[2].filters).toEqual([["id", ID], ...privateFilters, ["version", 1]]);
    expect(db.calls[2].payload).toEqual({ name: "Original Kite", data: edited });
    const savedData = (db.calls[2].payload as { data: typeof cinderlitKite }).data;
    expect(savedData.actions).toBe(raw.data.actions); expect(savedData.armor_class).toBe(raw.data.armor_class);
    expect(raw.effects[0]).toHaveProperty("extraMetadata", { label: "retain me" });
    expect(db.calls.every((call) => call.table !== "content_versions")).toBe(true);
  });
  it.each([[], ["description"]])("equal declared intent performs no UPDATE and no false version", async (intent) => {
    const db = database([ok({ id: SYSTEM }), ok(row())]);
    expect(await updateHomebrewMonsterRecord(form(true, cinderlitKite, intent))).toEqual({ status: "idle", message: "No changes to save." });
    expect(db.calls.some((call) => call.operation === "update")).toBe(false);
  });
  it("refuses an undeclared modified group before mutation", async () => {
    const db = database([ok({ id: SYSTEM }), ok(row())]);
    expect(await updateHomebrewMonsterRecord(form(true, { ...cinderlitKite, description: "Undeclared" }))).toMatchObject({ status: "error" });
    expect(db.calls).toHaveLength(2);
  });
  it("classifies race after exact read as current-owner conflict without retry", async () => {
    const edited = { ...cinderlitKite, description: "New" }, db = database([ok({ id: SYSTEM }), ok(row()), ok(null), ok(row(2))]);
    expect(await updateHomebrewMonsterRecord(form(true, edited, ["description"]))).toMatchObject({ status: "conflict" });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
    expect(db.calls[3].filters).toEqual([...privateFilters, ["id", ID]]);
  });
  it("denies inaccessible/retired/missing rows without foreign version disclosure", async () => {
    const db = database([ok({ id: SYSTEM }), ok(null), ok(null)]);
    expect(await updateHomebrewMonsterRecord(form(true))).toEqual({ status: "error", message: "This private monster could not be found." });
    expect(db.calls.some((call) => call.operation === "update")).toBe(false);
  });
  it.each([ok(null), ok(row(2)), ok(row(1, { data: { ...cinderlitKite, schema_version: 2 } })), { data: null, error: { code: "timeout" } }])("does not confirm missing/malformed/uncertain create response", async (reply) => {
    database([ok({ id: SYSTEM }), reply]);
    expect(await createHomebrewMonsterRecord(form())).toEqual({ status: "error", message: "The save could not be confirmed. Check your Homebrew list before trying again." });
  });
  it("does not confirm an UPDATE response with unchanged version or substituted data", async () => {
    database([ok({ id: SYSTEM }), ok(row()), ok(row())]);
    expect(await updateHomebrewMonsterRecord(form(true, cinderlitKite, [], "Renamed Kite"))).toMatchObject({ status: "error", message: expect.stringContaining("could not be confirmed") });
  });
  it("canonical private discovery and a separately supplied historical snapshot do not substitute latest data", () => {
    const original = row(), next = row(2, { name: "Revised Kite", data: { ...cinderlitKite, description: "Later" } });
    const snapshot = { content_id: ID, version: 1, system_id_snapshot: SYSTEM, content_type_snapshot: "monster", slug_snapshot: original.slug,
      name_snapshot: original.name, data_snapshot: original.data, effects_snapshot: original.effects, source_snapshot: "homebrew", scope_snapshot: "personal", owner_id_snapshot: OWNER };
    const pin = parseContentVersionSnapshot(snapshot);
    expect(pin).toMatchObject({ name: "Original Kite", version: 1, data: cinderlitKite });
    expect(parseContentDefinition(next)).toMatchObject({ name: "Revised Kite", version: 2, data: { description: "Later" } });
    expect(parseContentVersionSnapshot(snapshot)).toEqual(pin); // Parser preservation, not real trigger/snapshot proof.
  });
});
