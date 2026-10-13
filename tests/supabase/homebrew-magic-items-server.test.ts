import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { createHomebrewMagicItemRecord, getOwnedHomebrewMagicItem, listOwnedHomebrewMagicItems, updateHomebrewMagicItemRecord } from "@/lib/supabase/homebrew-magic-items-server";
import { effectSchema } from "@/lib/schemas/effects";

const OWNER = "11111111-1111-4111-8111-111111111111", SYSTEM = "22222222-2222-4222-8222-222222222222", ID = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const controls = { rarity: "Rare", description: "It points toward a synthetic promise.", equipment_category: "Wondrous item", requires_attunement: true };
function row(version = 1) { return { id: ID, system_id: SYSTEM, content_type: "magic_item", slug: "oathbound-compass-a1b2c3d4", name: "Oathbound Compass", data: controls,
  effects: [] as unknown[], source: "homebrew", scope: "personal", owner_id: OWNER, version, created_at: "2026-08-31T00:00:00.000Z", is_retired: false }; }
type Row = ReturnType<typeof row>;
function snapshot(r: Row) { return { content_id: r.id, version: r.version, system_id_snapshot: r.system_id, content_type_snapshot: r.content_type, slug_snapshot: r.slug,
  name_snapshot: r.name, data_snapshot: r.data, effects_snapshot: r.effects, source_snapshot: r.source, scope_snapshot: r.scope, owner_id_snapshot: r.owner_id }; }
function form(change: Record<string, string> = {}) {
  const f = new FormData(); f.set("name", row().name);
  for (const [k, v] of Object.entries({ ...controls, requires_attunement: "on", ...change })) f.set(k, String(v));
  return f;
}
interface Call { table: string; operation: string; payload?: Record<string, unknown>; filters: Array<[string, unknown]>; terminal?: string; order?: string }
interface Options { original?: unknown; createReturn?: (r: Row) => unknown; updateReturn?: (r: Row) => unknown; pinReturn?: (r: Row) => unknown;
  current?: unknown; auth?: boolean; authError?: boolean; system?: unknown; writeError?: boolean; writeThrow?: boolean; readError?: boolean; zeroCas?: boolean; list?: boolean }
function db(options: Options = {}) {
  const calls: Call[] = []; const original = options.original === undefined ? row() : options.original;
  let written: Row | undefined, issued = false;
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.auth === false ? null : { id: OWNER } }, error: options.authError ? { message: "secret" } : null }) },
    from: vi.fn((table: string) => {
      const call: Call = { table, operation: "select", filters: [] }; calls.push(call);
      function reply() {
        if (table === "game_systems") return { data: options.system === undefined ? { id: SYSTEM } : options.system, error: null };
        if (table === "content_versions") return { data: options.pinReturn ? options.pinReturn(written!) : snapshot(written!), error: null };
        if (call.operation === "insert" || call.operation === "update") {
          issued = true;
          if (options.writeThrow) throw Error("private transport detail");
          if (options.writeError) return { data: null, error: { message: "private database detail" } };
          if (options.zeroCas) return { data: null, error: null };
          const base = call.operation === "insert" ? row() : original as Row;
          written = { ...base, ...call.payload, version: call.operation === "insert" ? 1 : base.version + 1 } as Row;
          return { data: call.operation === "insert" ? (options.createReturn ? options.createReturn(written) : written)
            : (options.updateReturn ? options.updateReturn(written) : written), error: null };
        }
        if (options.readError) return { data: null, error: { message: "read detail" } };
        return { data: issued ? options.current ?? null : options.list ? [original] : original, error: null };
      }
      const builder = { select: vi.fn(() => builder), insert: (payload: Record<string, unknown>) => { call.operation = "insert"; call.payload = payload; return builder; },
        update: (payload: Record<string, unknown>) => { call.operation = "update"; call.payload = payload; return builder; },
        eq: (key: string, value: unknown) => { call.filters.push([key, value]); return builder; }, order: (key: string) => { call.order = key; return builder; },
        single: async () => { call.terminal = "single"; return reply(); }, maybeSingle: async () => { call.terminal = "maybeSingle"; return reply(); },
        then: (resolve: (result: ReturnType<typeof reply>) => unknown) => Promise.resolve(reply()).then(resolve) };
      return builder;
    }) };
  mocks.createClient.mockResolvedValue(client); return { client, calls };
}
function writes(calls: Call[]) { return calls.filter(c => ["insert", "update"].includes(c.operation)); }
function scope(call: Call, id?: string, version?: number) {
  expect(call.filters).toEqual(expect.arrayContaining([["owner_id", OWNER], ["system_id", SYSTEM], ["content_type", "magic_item"], ["source", "homebrew"], ["scope", "personal"], ["is_retired", false],
    ...(id ? [["id", id]] : []), ...(version ? [["version", version]] : [])]));
}
beforeEach(() => vi.clearAllMocks());

describe("magic-item exact private save", () => {
  it("derives a frozen UUID/slug/private envelope, ignores browser authority, and confirms exact immutable pin", async () => {
    const d = db(); const f = form(); f.set("owner_id", OTHER); f.set("effects", "forged"); f.set("scope", "platform"); f.set("version", "99");
    const result = await createHomebrewMagicItemRecord(f);
    expect(result).toMatchObject({ status: "saved", operation: "create", version: 1 });
    const payload = writes(d.calls)[0].payload!;
    expect(payload).toMatchObject({ system_id: SYSTEM, content_type: "magic_item", name: row().name, data: controls, effects: [], source: "homebrew", scope: "personal", owner_id: OWNER });
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/); expect(payload.slug).toMatch(/^oathbound-compass-[0-9a-f]{8}$/); expect(payload).not.toHaveProperty("version");
    expect(d.calls[0]).toMatchObject({ terminal: "single", filters: [["slug", "dnd-5e-2014"], ["status", "published"]] });
    expect(d.calls.at(-1)?.filters).toEqual([["content_id", payload.id], ["version", 1], ["owner_id_snapshot", OWNER], ["system_id_snapshot", SYSTEM], ["content_type_snapshot", "magic_item"], ["source_snapshot", "homebrew"], ["scope_snapshot", "personal"]]);
  });
  it.each([{ auth: false }, { authError: true }])("authenticates before every table/write: %j", async options => {
    const d = db(options); expect(await createHomebrewMagicItemRecord(form())).toMatchObject({ status: "error" }); expect(d.calls).toEqual([]);
  });
  it("returns bounded named validation before persistence context", async () => {
    const d = db(); const result = await createHomebrewMagicItemRecord(form({ name: "" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { name: ["Name is required."] } }); expect(d.calls).toEqual([]);
  });
  it.each([null, [], [{ id: SYSTEM }, { id: SYSTEM }], { id: "invalid" }])("refuses unavailable/duplicate/malformed canonical system %j", async system => {
    const d = db({ system }); expect(await createHomebrewMagicItemRecord(form())).toMatchObject({ status: "error" }); expect(writes(d.calls)).toHaveLength(0);
  });
  it.each(["writeError", "writeThrow"] as const)("issued %s is uncertainty, no leaked detail/retry", async key => {
    const d = db({ [key]: true }); const result = await createHomebrewMagicItemRecord(form());
    expect(result).toMatchObject({ status: "uncertain" }); expect(JSON.stringify(result)).not.toContain("private database"); expect(writes(d.calls)).toHaveLength(1);
  });
  it.each([null, undefined])("missing issued create return%j retains uncertainty without another INSERT", async returned => {
    const d = db({ createReturn: () => returned }); expect(await createHomebrewMagicItemRecord(form())).toMatchObject({ status: "uncertain" }); expect(writes(d.calls)).toHaveLength(1);
  });
  it("lists/loads only owned current active rows", async () => {
    const d = db({ list: true }); expect(await listOwnedHomebrewMagicItems()).toEqual([row()]); scope(d.calls[1]); expect(d.calls[1].order).toBe("name");
    const e = db(); expect(await getOwnedHomebrewMagicItem(ID)).toEqual(row()); scope(e.calls[1], ID);
    const invalid = db(); expect(await getOwnedHomebrewMagicItem("invalid")).toBeNull(); expect(invalid.calls).toHaveLength(0);
  });
  it("independently rejects a foreign body despite scoped query", async () => {
    db({ original: { ...row(), owner_id: OTHER } }); await expect(getOwnedHomebrewMagicItem(ID)).rejects.toThrow();
  });
});

describe("actual-old-export acknowledgment baseline controls", () => {
  // All bad-return fixtures remain otherwise valid under the old row parser.
  it.each([
    ["id", OTHER], ["owner_id", OTHER], ["system_id", OTHER], ["content_type", "spell"], ["source", "srd"], ["scope", "shared"], ["is_retired", true], ["version", 2],
    ["name", "Another synthetic item"], ["slug", "another-synthetic-item"], ["data", { ...controls, description: "A different description." }], ["effects", [{ type: "mechanical", stat: "strength", op: "add", value: 1 }]],
  ])("does not acknowledge otherwise-valid wrong create %s", async (key, value) => {
    const d = db({ createReturn: r => ({ ...r, [key as string]: value }) });
    expect(await createHomebrewMagicItemRecord(form())).toMatchObject({ status: "uncertain" }); expect(writes(d.calls)).toHaveLength(1);
  });
  it.each([null, { content_id: OTHER }, { version: 2 }, { system_id_snapshot: OTHER }, { content_type_snapshot: "spell" }, { name_snapshot: "Other synthetic name" }, { slug_snapshot: "other-synthetic-slug" },
    { data_snapshot: { ...controls, description: "Wrong pin" } }, { effects_snapshot: [{ type: "narrative", text: "Different" }] }, { owner_id_snapshot: OTHER }, { source_snapshot: "srd" }, { scope_snapshot: "shared" }])("does not accept a missing/wrong immutable pin %j", async alteration => {
    const d = db({ pinReturn: r => alteration === null ? null : { ...snapshot(r), ...alteration } });
    expect(await createHomebrewMagicItemRecord(form())).toMatchObject({ status: "uncertain" }); expect(writes(d.calls)).toHaveLength(1);
  });
  it("valid create positive constructs against both actual old and repaired exports", async () => {
    const d = db(); const result = await createHomebrewMagicItemRecord(form()); const payload = writes(d.calls)[0].payload!;
    // Preserve a real old-path positive for the controlled baseline; no missing new export/schema.
    if ("status" in result) expect(result).toMatchObject({ status: "saved", version: 1, id: payload.id });
    else expect(result).toMatchObject({ id: ID, name: row().name, data: controls, effects: [] });
  });
});

describe("raw metadata edit CAS", () => {
  it("preserves effects/raw nested extensions and omits effects in the only UPDATE", async () => {
    const effects = [{ type: "mechanical", stat: "armor_class", op: "add", value: 1, extension: { manual: true } },
      { type: "mechanical", stat: "strength", op: "formula", expr: "strength + 1", condition: { field: "synthetic_ready", op: "eq", value: true }, extension: { original: true } },
      { type: "narrative", text: "Original", extension: 0 }];
    effects.forEach(e => expect(effectSchema.safeParse(e).success).toBe(true));
    const raw = { ...controls, source_refs: [{ slug: "synthetic" }], custom: { nested: [1, 0, null] } };
    const d = db({ original: { ...row(), data: raw, effects } }); const f = form({ name: "New Compass" }); f.set("data", "forged"); f.set("effects", "forged");
    expect(await updateHomebrewMagicItemRecord(ID, 1, f)).toMatchObject({ status: "saved", operation: "edit", id: ID, version: 2 });
    expect(writes(d.calls)).toHaveLength(1); const update = writes(d.calls)[0];
    expect(update.payload).toEqual({ name: "New Compass", data: raw }); expect(update.payload).not.toHaveProperty("effects"); scope(update, ID, 1);
    expect(d.calls.at(-1)?.filters).toContainEqual(["version", 2]);
    expect(raw).toEqual({ ...controls, source_refs: [{ slug: "synthetic" }], custom: { nested: [1, 0, null] } });
    expect(effects[0]).toHaveProperty("extension", { manual: true });
    // No current-row reread/repin after confirmation: a later edit/scope cannot
    // be inferred from this exact v2 snapshot. Historical v1 input stays intact.
    expect(d.calls.slice(d.calls.indexOf(update) + 1).map(call => call.table)).toEqual(["content_versions"]);
  });
  it("keeps absence/defaults/raw whitespace and returns true no-op without UPDATE even at MAX", async () => {
    const raw = { description: "  It points toward a synthetic promise.  ", custom: { keep: true } };
    const d = db({ original: { ...row(2_147_483_647), name: "  Oathbound Compass  ", data: raw } });
    const f = form({ rarity: "Common", equipment_category: "" }); f.delete("requires_attunement");
    expect(await updateHomebrewMagicItemRecord(ID, 2_147_483_647, f)).toMatchObject({ status: "unchanged", id: ID, version: 2_147_483_647 }); expect(writes(d.calls)).toHaveLength(0);
  });
  it("explicit category clear removes only the controlled key", async () => {
    const raw = { ...controls, custom: { keep: true } }; const d = db({ original: { ...row(), data: raw } });
    expect(await updateHomebrewMagicItemRecord(ID, 1, form({ equipment_category: "" }))).toMatchObject({ status: "saved" });
    expect(writes(d.calls)[0].payload?.data).toEqual({ rarity: controls.rarity, description: controls.description, requires_attunement: true, custom: raw.custom });
  });
  it("changed MAX version refuses without UPDATE", async () => { const d = db({ original: row(2_147_483_647) }); expect(await updateHomebrewMagicItemRecord(ID, 2_147_483_647, form({ name: "Changed" }))).toMatchObject({ status: "error" }); expect(writes(d.calls)).toHaveLength(0); });
  it.each([null, [{ type: "unknown" }], [{ type: "mechanical", op: "formula", stat: "strength" }]])("invalid original effects %j cannot be repaired by metadata update", async effects => {
    const d = db({ original: { ...row(), effects } }); expect(await updateHomebrewMagicItemRecord(ID, 1, form({ name: "Changed" }))).toMatchObject({ status: "error" }); expect(writes(d.calls)).toHaveLength(0);
  });
  it.each([0, 2_147_483_648, NaN, Infinity, 1.5])("invalid expected version %s refuses before table read", async version => { const d = db(); expect(await updateHomebrewMagicItemRecord(ID, version, form())).toMatchObject({ status: "error" }); expect(d.calls).toHaveLength(0); });
  it.each([{ ...row(), owner_id: OTHER }, { ...row(), system_id: OTHER }, { ...row(), scope: "shared" }, { ...row(), is_retired: true }, { ...row(), version: 2 }])("ineligible initial body cannot authorize UPDATE %j", async original => {
    const d = db({ original }); expect(await updateHomebrewMagicItemRecord(ID, 1, form({ name: "Changed" }))).toMatchObject({ status: "error" }); expect(writes(d.calls)).toHaveLength(0);
  });
  it.each([1, 0, 2])("post-issued zero CAS reread version%s is conflict only when strictly newer", async version => {
    const d = db({ zeroCas: true, current: row(version) }); const result = await updateHomebrewMagicItemRecord(ID, 1, form({ name: "Changed" }));
    expect(result).toMatchObject({ status: version > 1 ? "conflict" : "uncertain" }); expect(writes(d.calls)).toHaveLength(1); scope(d.calls.at(-1)!, ID);
  });
  it.each([null, { ...row(2), owner_id: OTHER }, { ...row(2), is_retired: true }, { ...row(2), effects: null }])("ineligible/inconclusive post-CAS reread is uncertainty %j", async current => {
    const d = db({ zeroCas: true, current }); expect(await updateHomebrewMagicItemRecord(ID, 1, form({ name: "Changed" }))).toMatchObject({ status: "uncertain" }); expect(writes(d.calls)).toHaveLength(1);
  });
  it.each([{ version: 1 }, { version: 3 }, { name: "Other" }, { created_at: "2026-09-01T00:00:00.000Z" }, { slug: "other" }, { effects: [] }])("changed-write wrong result is uncertainty %j", async alteration => {
    const effects = [{ type: "narrative", text: "Original" }]; const d = db({ original: { ...row(), effects }, updateReturn: r => ({ ...r, ...alteration }) });
    expect(await updateHomebrewMagicItemRecord(ID, 1, form({ name: "Changed" }))).toMatchObject({ status: "uncertain" }); expect(writes(d.calls)).toHaveLength(1);
  });
});
