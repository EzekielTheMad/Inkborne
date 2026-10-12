import { beforeEach, describe, expect, it, vi } from "vitest";
import { npcEnvelope, npcSnapshot, npcOwnerId, npcSystemId, npcRejectedEffects } from "@/tests/fixtures/npcs";
const state = vi.hoisted(() => ({ user: true, systemError: false, reads: [] as unknown[], insertReply: undefined as unknown,
  updateReply: undefined as unknown, snapshotReply: undefined as unknown, snapshotCase: "" as string, last: undefined as unknown,
  requests: [] as Array<{ table: string; operation: string; filters: unknown[][]; payload?: unknown }> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user ? { id: "b1711111-1111-4111-8111-000000000003" } : null }, error: null }) },
  from: (table: string) => {
    const request = { table, operation: "read", filters: [] as unknown[][], payload: undefined as unknown };
    const finish = () => {
      state.requests.push({ ...request, filters: [...request.filters] });
      if (table === "game_systems") return { data: { id: "b1711111-1111-4111-8111-000000000002" }, error: state.systemError ? { message: "Synthetic missing/duplicate system" } : null };
      if (table === "content_versions") {
        const pin = snapshotFor(state.last);
        const data = state.snapshotCase === "missing" ? null : pin && state.snapshotCase === "version" ? { ...pin, version: pin.version + 1 }
          : pin && state.snapshotCase === "owner" ? { ...pin, owner_id_snapshot: "b1711111-1111-4111-8111-000000000099" }
          : pin && state.snapshotCase === "scope" ? { ...pin, scope_snapshot: "shared" }
          : pin && state.snapshotCase === "effect" ? { ...pin, effects_snapshot: [{ type: "mechanical", stat: "strength", op: "add", value: 2 }] }
          : state.snapshotReply === undefined ? pin : state.snapshotReply;
        return { data, error: state.snapshotCase === "error" ? { message: "Synthetic snapshot read failed" } : null };
      }
      if (request.operation === "insert") {
        const row = { ...(request.payload as object), version: 1, created_at: "2026-10-12T12:00:00Z", is_retired: false };
        state.last = state.insertReply === undefined ? row : state.insertReply; return { data: state.last, error: null };
      }
      if (request.operation === "update") { state.last = state.updateReply; return { data: state.updateReply, error: null }; }
      return { data: state.reads.shift() ?? null, error: null };
    };
    const chain = { select: () => chain, eq: (key: string, value: unknown) => { request.filters.push([key, value]); return chain; }, order: () => chain,
      insert: (payload: unknown) => { request.operation = "insert"; request.payload = payload; return chain; },
      update: (payload: unknown) => { request.operation = "update"; request.payload = payload; return chain; },
      single: async () => finish(), maybeSingle: async () => finish(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(finish()).then(resolve) };
    return chain;
  },
}) }));
function snapshotFor(raw: unknown) {
  if (!raw) return null; return npcSnapshot(raw as ReturnType<typeof npcEnvelope>);
}
import { createHomebrewNpcRecord, updateHomebrewNpcRecord } from "@/lib/supabase/homebrew-npcs-server";
const original = () => ({ ...npcEnvelope(), created_at: "2026-10-12T12:00:00Z", is_retired: false });
function input(edit = false, version = 1, changed = true) {
  const form = new FormData(); form.set("name", "Original Bridge Keeper");
  form.set("npc_data", JSON.stringify(changed ? { ...npcEnvelope().data, description: "New original text." } : npcEnvelope().data));
  if (edit) { form.set("id", original().id); form.set("expected_version", String(version)); form.set("changed_fields", changed ? '["description"]' : "[]"); } return form;
}
beforeEach(() => { state.user = true; state.systemError = false; state.reads = []; state.requests = []; state.insertReply = undefined;
  state.updateReply = undefined; state.snapshotReply = undefined; state.snapshotCase = ""; state.last = undefined; vi.spyOn(console, "error").mockImplementation(() => {}); });
describe("private NPC DAL modeled PostgREST, no real authority acceptance", () => {
  it("freezes server identity/private envelope, confirms exact snapshot and ignores browser authority", async () => {
    const form = input(); form.set("id", original().id); form.set("owner_id", original().id); form.set("effects", "forged");
    const result = await createHomebrewNpcRecord(form); expect(result.status).toBe("saved");
    const write = state.requests.find(request => request.operation === "insert")!;
    expect(write.payload).toMatchObject({ owner_id: npcOwnerId, system_id: npcSystemId, effects: [], content_type: "npc", scope: "personal", source: "homebrew" });
    expect((write.payload as { id: string }).id).not.toBe(original().id);
    const pin = state.requests.find(request => request.table === "content_versions")!;
    expect(pin.filters).toContainEqual(["content_id", (write.payload as { id: string }).id]); expect(pin.filters).toContainEqual(["version", 1]);
  });
  it.each(["anonymous", "system"])("%s never writes", async kind => {
    state.user = kind !== "anonymous"; state.systemError = kind === "system"; expect((await createHomebrewNpcRecord(input())).status).toBe("error");
    expect(state.requests.some(request => request.operation !== "read")).toBe(false);
  });
  it.each(["missing", "version", "owner", "scope", "effect", "error"])("uncertain isolated exact snapshot %s never retries", async kind => {
    state.snapshotCase = kind; expect((await createHomebrewNpcRecord(input())).status).toBe("uncertain");
    expect(state.requests.filter(request => request.operation === "insert")).toHaveLength(1);
  });
  it("performs owner/private/active CAS, omits effects and confirms v+1 without reading latest v+2", async () => {
    const row = original(); state.reads = [row, { ...row, version: 3, scope: "shared" }];
    state.updateReply = { ...row, version: 2, data: { ...row.data, description: "New original text." } };
    expect(await updateHomebrewNpcRecord(input(true))).toMatchObject({ status: "saved", version: 2 });
    const write = state.requests.find(request => request.operation === "update")!;
    expect(Object.keys(write.payload as object).sort()).toEqual(["data", "name"]);
    for (const filter of [["owner_id", npcOwnerId], ["system_id", npcSystemId], ["content_type", "npc"], ["source", "homebrew"], ["scope", "personal"], ["is_retired", false], ["version", 1]]) expect(write.filters).toContainEqual(filter);
    expect(state.reads).toHaveLength(1); expect(state.requests.find(request => request.table === "content_versions")!.filters).toContainEqual(["version", 2]);
  });
  it.each([1, 2, 3])("zero-row CAS expected2 eligible reread version%s classifies strictly newer only", async version => {
    state.reads = [{ ...original(), version: 2 }, { ...original(), version }]; state.updateReply = null;
    const result = await updateHomebrewNpcRecord(input(true, 2));
    expect(result.status).toBe(version === 3 ? "conflict" : "uncertain");
    expect(state.requests.filter(request => request.operation === "update")).toHaveLength(1);
  });
  it.each([npcRejectedEffects[0], npcRejectedEffects[1], npcRejectedEffects[2], npcRejectedEffects[3], null, undefined])("unsupported raw effects%j block before mutation", async effects => {
    state.reads = [{ ...original(), effects: effects === null || effects === undefined ? effects : [effects] }];
    expect((await updateHomebrewNpcRecord(input(true))).status).toBe("error"); expect(state.requests.some(request => request.operation === "update")).toBe(false);
  });
  it("locked raw extensions/foreign rows and pgMAX changed vs no-op preserve originals", async () => {
    state.reads = [{ ...original(), data: { ...original().data, extension: { dm: "original" } } }];
    expect((await updateHomebrewNpcRecord(input(true))).status).toBe("error");
    state.reads = [{ ...original(), owner_id: original().id }]; expect((await updateHomebrewNpcRecord(input(true))).status).toBe("error");
    state.reads = [{ ...original(), version: 2_147_483_647 }]; expect((await updateHomebrewNpcRecord(input(true, 2_147_483_647))).status).toBe("error");
    state.reads = [{ ...original(), version: 2_147_483_647 }]; expect((await updateHomebrewNpcRecord(input(true, 2_147_483_647, false))).status).toBe("unchanged");
    expect(state.requests.some(request => request.operation === "update")).toBe(false);
  });
  it("malformed many-path edit with invalid identity/intent refuses before DAL mutation", async () => {
    const form = input(true); form.set("id", "bad"); form.set("expected_version", "0"); form.set("changed_fields", "{");
    form.set("npc_data", JSON.stringify({ schema_version: 1, relationships: Array.from({ length: 500 }, () => ({ name: 0, relationship: 0, description: 0 })) }));
    const result = await updateHomebrewNpcRecord(form); expect(result.status).toBe("error");
    if ("fieldErrors" in result) expect(Object.keys(result.fieldErrors ?? {}).length).toBeLessThanOrEqual(100);
    expect(state.requests.some(request => request.operation === "update")).toBe(false);
  });
});
