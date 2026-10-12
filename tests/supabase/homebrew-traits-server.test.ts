import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { createHomebrewTraitRecord, getOwnedHomebrewTrait, listOwnedHomebrewTraits, updateHomebrewTraitRecord } from "@/lib/supabase/homebrew-traits-server";

const USER = "11111111-1111-4111-8111-111111111111", SYSTEM = "22222222-2222-4222-8222-222222222222", ID = "33333333-3333-4333-8333-333333333333";
interface Call { table: string; operation: "select" | "insert" | "update"; payload?: Record<string, unknown>; filters: Array<[string, unknown]>; single?: string; order?: string }
interface Reply { data: unknown; error: { code?: string; message?: string } | null }
type Response = Reply | Error | ((call: Call) => Reply);
function client(responses: Response[], authenticated = true) {
  const calls: Call[] = [];
  const database = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: authenticated ? { id: USER } : null }, error: null }) },
    from: vi.fn((table: string) => {
      const response = responses[calls.length] ?? { data: null, error: null };
      const call: Call = { table, operation: "select", filters: [] }; calls.push(call);
      const resolve = () => response instanceof Error ? Promise.reject(response) : Promise.resolve(typeof response === "function" ? response(call) : response);
      const query = { select: () => query, eq: (key: string, value: unknown) => { call.filters.push([key, value]); return query; },
        order: (key: string) => { call.order = key; return query; },
        insert: (payload: Record<string, unknown>) => { call.operation = "insert"; call.payload = payload; return query; },
        update: (payload: Record<string, unknown>) => { call.operation = "update"; call.payload = payload; return query; },
        single: () => { call.single = "single"; return resolve(); }, maybeSingle: () => { call.single = "maybeSingle"; return resolve(); },
        then: (callback: (value: Reply) => unknown) => resolve().then(callback) };
      return query;
    }) };
  mocks.createClient.mockResolvedValue(database);
  return { database, calls };
}
const system: Reply = { data: { id: SYSTEM }, error: null };
function row(data: Record<string, unknown> = { description: "Original synthetic memory." }, version = 1) {
  return { id: ID, system_id: SYSTEM, content_type: "trait", slug: "original-trait", name: "Lantern memory", data, effects: [] as unknown[],
    source: "homebrew", scope: "personal", owner_id: USER, version, created_at: "2026-10-11T00:00:00Z", is_retired: false };
}
function input(values: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Lantern memory", description: "Original synthetic memory.", usages: "", recovery: "", ...values })) form.set(key, value);
  return form;
}
const created = (call: Call): Reply => ({ data: { ...row(), ...call.payload }, error: null });
function scope(call: Call, version?: number) {
  expect(call.filters).toEqual(expect.arrayContaining([["owner_id", USER], ["system_id", SYSTEM], ["content_type", "trait"], ["source", "homebrew"], ["scope", "personal"], ["is_retired", false], ...(version ? [["version", version]] : [])]));
}
beforeEach(() => vi.clearAllMocks());
describe("standalone private trait persistence", () => {
  it("authenticates and derives creation authority, confirms only the matching returned row", async () => {
    const db = client([system, created]);
    const result = await createHomebrewTraitRecord(input({ owner_id: "forged", system_id: "forged", source: "srd", scope: "shared", effects: "[]", data: "{}", races: "forged", version: "100" }));
    expect(result).toMatchObject({ content_type: "trait", owner_id: USER, system_id: SYSTEM, version: 1, resourceEditable: true });
    expect(db.database.auth.getUser).toHaveBeenCalledOnce();
    expect(db.calls[0]).toMatchObject({ table: "game_systems", single: "single", filters: [["slug", "dnd-5e-2014"], ["status", "published"]] });
    expect(db.calls[1].payload).toMatchObject({ content_type: "trait", owner_id: USER, system_id: SYSTEM, source: "homebrew", scope: "personal", effects: [],
      data: { description: "Original synthetic memory.", races: [], subraces: [], extraLimitedFeatures: [], recovery: null } });
    expect(db.calls[1].payload).not.toHaveProperty("version");
    expect(db.calls).toHaveLength(2);
  });
  it("does not write unauthenticated or unpublished/duplicate-system creations", async () => {
    const unauthenticated = client([], false);
    expect(await createHomebrewTraitRecord(input())).toMatchObject({ status: "error" });
    expect(unauthenticated.calls).toHaveLength(0);
    const duplicate = client([{ data: null, error: { code: "PGRST116" } }]);
    expect(await createHomebrewTraitRecord(input())).toMatchObject({ status: "error" });
    expect(duplicate.calls).toHaveLength(1);
  });
  it.each([null, {}, { description: "malformed" }])("retains uncertainty for missing/malformed CREATE response %j", data => {
    client([system, { data, error: null }]);
    return expect(createHomebrewTraitRecord(input())).resolves.toMatchObject({ status: "uncertain", message: expect.stringContaining("Check your private Homebrew") });
  });
  it.each(["owner_id", "system_id", "content_type", "scope", "source", "is_retired", "version", "name", "data", "effects", "id"])("never confirms mismatched returned CREATE %s", key => {
    const overrides: Record<string, unknown> = { owner_id: ID, system_id: ID, content_type: "feat", scope: "shared", source: "srd", is_retired: true,
      version: 2, name: "Unexpected", data: { description: "Unexpected" }, effects: [{ type: "narrative", text: "Unexpected" }], id: ID };
    const db = client([system, call => ({ data: { ...row(), ...call.payload, [key]: overrides[key] }, error: null })]);
    return expect(createHomebrewTraitRecord(input())).resolves.toMatchObject({ status: "uncertain" }).then(() => expect(db.calls.filter(call => call.operation === "insert")).toHaveLength(1));
  });
  it("a lost/ambiguous CREATE response never retries the INSERT", async () => {
    for (const response of [new Error("Synthetic transport loss after save"), { data: null, error: { message: "No confirmed result" } }]) {
      const db = client([system, response]);
      expect(await createHomebrewTraitRecord(input())).toMatchObject({ status: "uncertain" });
      expect(db.calls.filter(call => call.operation === "insert")).toHaveLength(1);
    }
  });
  it.each<{ usages?: number; recovery?: "long rest" | null }>([{}, { recovery: null }, { usages: 0 }, { usages: 0, recovery: null }, { usages: 2, recovery: "long rest" }])("description-only CAS preserves original raw resource keys %j", async resource => {
    const original = row({ description: "Original synthetic memory.", ...resource, races: ["existing-race"], subraces: ["existing-subrace"],
      extraLimitedFeatures: [{ name: "Separate light", usages: 1, recovery: "short rest", original: true }], custom: { nested: ["original", { retained: true }] } }, 3);
    original.effects = [{ type: "mechanical", stat: "strength", op: "add", value: 2, unknown: { preserved: true } },
      { type: "mechanical", stat: "strength", op: "formula", expr: "strength + 2" }, { type: "mechanical", stat: "strength", op: "add", value: 2, condition: { field: "rage_active", op: "eq", value: true } },
      { type: "narrative", text: "Original effect intent is independent." }];
    const before = structuredClone(original);
    const db = client([system, { data: original, error: null }, call => ({ data: { ...original, ...call.payload, version: 4 }, error: null })]);
    const result = await updateHomebrewTraitRecord(ID, 3, input({ description: "Revised metadata.", usages: resource.usages?.toString() ?? "", recovery: resource.recovery ?? "",
      custom: "forged", races: "[]", extraLimitedFeatures: "[]", effects: "[]", data: "{}", owner_id: "forged" }));
    expect(result).toMatchObject({ version: 4, data: { description: "Revised metadata." } });
    scope(db.calls[1], 3); scope(db.calls[2], 3);
    expect(db.calls[2].payload).toEqual({ name: original.name, data: { ...before.data, description: "Revised metadata." } });
    expect(db.calls[2].payload).not.toHaveProperty("effects"); expect(original).toEqual(before);
  });
  it.each([{ usages: Array(20).fill(2), recovery: "short rest" }, { usages: 2, recovery: "dawn" }, { usages: 2, recovery: "day" }, { usages: 2 }, { usages: 1.5, recovery: "long rest" }])("locks legacy pair %j against a forged browser unlock", async resource => {
    const original = row({ description: "Original synthetic memory.", ...resource }, 1);
    const db = client([system, { data: original, error: null }, call => ({ data: { ...original, ...call.payload, version: 2 }, error: null })]);
    expect(await updateHomebrewTraitRecord(ID, 1, input({ usages: "999", recovery: "long rest", resourceEditable: "true" }))).toMatchObject({ resourceEditable: false });
    expect(db.calls[2].payload?.data).toEqual(original.data);
  });
  it("explicit resource clear removes count while preserving unchanged recovery absence", async () => {
    const original = row({ description: "Original synthetic memory.", usages: 0, custom: { unchanged: true } }, 1);
    const db = client([system, { data: original, error: null }, call => ({ data: { ...original, ...call.payload, version: 2 }, error: null })]);
    await updateHomebrewTraitRecord(ID, 1, input());
    expect(db.calls[2].payload?.data).toEqual({ description: original.data.description, custom: { unchanged: true } });
  });
  it("stale CAS attempts one write and rereads only the exact private envelope", async () => {
    const original = row({}, 2); original.data = { description: "Original synthetic memory." };
    const db = client([system, { data: original, error: null }, { data: null, error: null }, { data: { ...original, version: 3 }, error: null }]);
    expect(await updateHomebrewTraitRecord(ID, 2, input())).toMatchObject({ status: "conflict" });
    expect(db.calls.filter(call => call.operation === "update")).toHaveLength(1);
    scope(db.calls[3]); expect(db.calls[3].filters).toContainEqual(["id", ID]);
  });
  it("foreign/missing expected row makes no write and only a scoped reread", async () => {
    const db = client([system, { data: null, error: null }, { data: null, error: null }]);
    expect(await updateHomebrewTraitRecord(ID, 1, input())).toMatchObject({ status: "error" });
    expect(db.calls.filter(call => call.operation === "update")).toHaveLength(0); scope(db.calls[1], 1); scope(db.calls[2]);
  });
  it.each([0, 1.5, 2_147_483_648, Number.MAX_SAFE_INTEGER, NaN])("rejects out-of-contract version %s before queries", async version => {
    const db = client([]); expect(await updateHomebrewTraitRecord(ID, version, input())).toMatchObject({ status: "error" }); expect(db.calls).toHaveLength(0);
  });
  it("rejects an unexpected foreign/retired/type response before edit", async () => {
    for (const overrides of [{ owner_id: ID }, { system_id: ID }, { is_retired: true }, { scope: "shared" }, { content_type: "race" }]) {
      const db = client([system, { data: { ...row(), ...overrides }, error: null }]);
      expect(await updateHomebrewTraitRecord(ID, 1, input())).toMatchObject({ status: "error" }); expect(db.calls).toHaveLength(2);
    }
  });
  it("lists/gets only owned active private traits and rejects mismatched response authority", async () => {
    const db = client([system, { data: [row()], error: null }]);
    expect(await listOwnedHomebrewTraits()).toHaveLength(1); scope(db.calls[1]); expect(db.calls[1].order).toBe("name");
    const get = client([system, { data: row(), error: null }]); expect(await getOwnedHomebrewTrait(ID)).toMatchObject({ id: ID }); scope(get.calls[1]);
    client([system, { data: { ...row(), owner_id: ID }, error: null }]); await expect(getOwnedHomebrewTrait(ID)).rejects.toThrow(/ownership/);
  });
});
