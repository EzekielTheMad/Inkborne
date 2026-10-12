import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), uuid: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:crypto")>(),
  randomUUID: mocks.uuid,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { createHomebrewPassiveFeatureRecord, getOwnedHomebrewPassiveFeature, listOwnedHomebrewPassiveFeatures, updateHomebrewPassiveFeatureRecord } from "@/lib/supabase/homebrew-passive-features-server";
import { FEATURE_VERSION_MAX } from "@/lib/homebrew/passive-feature-form";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { extendedFeatureData, extendedFeatureEffects, passiveFeatureCreateForm, passiveFeatureData, passiveFeatureEditForm, passiveFeatureId as ID,
  passiveFeatureOwner as OWNER, passiveFeatureRow, passiveFeatureSystem as SYSTEM } from "@/tests/fixtures/passive-features";

type Reply = { data: unknown; error: { code?: string } | null };
type Call = { table: string; operation: string; payload?: unknown; filters: [string, unknown][]; terminal?: string };
const ok = (data: unknown): Reply => ({ data, error: null });
function database(replies: Reply[], authenticated = true) {
  const calls: Call[] = []; let index = 0;
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: authenticated ? { id: OWNER } : null }, error: null }) },
    rpc: vi.fn(() => { throw Error("Any feature RPC/grant is forbidden by this fixture."); }),
    from(table: string) {
      if (!["game_systems", "content_definitions"].includes(table)) throw Error("Forbidden character/ref/grant/acquisition/inventory/snapshot table: " + table);
      const reply = replies[index++] ?? ok(null), call: Call = { table, operation: "select", filters: [] }; calls.push(call);
      const builder = { select: () => builder, order: () => builder,
        eq(key: string, value: unknown) { call.filters.push([key, value]); return builder; },
        insert(payload: unknown) { if (table !== "content_definitions") throw Error("Forbidden write"); call.operation = "insert"; call.payload = payload; return builder; },
        update(payload: unknown) { if (table !== "content_definitions") throw Error("Forbidden write"); call.operation = "update"; call.payload = payload; return builder; },
        single() { call.terminal = "single"; return Promise.resolve(reply); }, maybeSingle() { call.terminal = "maybeSingle"; return Promise.resolve(reply); },
        then(resolve: (value: Reply) => unknown) { return Promise.resolve(reply).then(resolve); },
      }; return builder;
    },
  }; mocks.createClient.mockResolvedValue(client); return { client, calls };
}
const filters: [string, unknown][] = [["owner_id", OWNER], ["system_id", SYSTEM], ["content_type", "feature"], ["source", "homebrew"], ["scope", "personal"], ["is_retired", false]];
beforeEach(() => { vi.clearAllMocks(); mocks.uuid.mockReturnValue(ID); });
describe("private standalone feature DAL; mocks do not prove real RLS/grants", () => {
  it("validates real canonical fixtures without writing parser defaults", () => {
    expect(featureDataSchema.safeParse(passiveFeatureData).success).toBe(true); expect(featureDataSchema.safeParse(extendedFeatureData).success).toBe(true);
    expect(featureDataSchema.parse(passiveFeatureData)).toHaveProperty("weaponOptions", []); expect(passiveFeatureData).not.toHaveProperty("weaponOptions");
  });
  it("creates only a server-derived private passive definition; no attachment/RPC/grant/other write", async () => {
    const db = database([ok({ id: SYSTEM }), ok(passiveFeatureRow())]);
    expect(await createHomebrewPassiveFeatureRecord(passiveFeatureCreateForm())).toEqual({ status: "saved", id: ID, version: 1, operation: "create" });
    expect(db.calls[0]).toMatchObject({ terminal: "single", filters: [["slug", "dnd-5e-2014"], ["status", "published"]] });
    expect(db.calls[1].payload).toEqual({ id: ID, system_id: SYSTEM, content_type: "feature", slug: "lantern-cadence-11111111", name: "Lantern Cadence",
      data: passiveFeatureData, effects: [], source: "homebrew", scope: "personal", owner_id: OWNER });
    expect(db.calls[1].payload).not.toHaveProperty("version"); expect(db.calls).toHaveLength(2); expect(db.client.rpc).not.toHaveBeenCalled();
  });
  it.each([createHomebrewPassiveFeatureRecord, updateHomebrewPassiveFeatureRecord])("requires authentication before persistence", async operation => {
    const db = database([], false); const form = operation === createHomebrewPassiveFeatureRecord ? passiveFeatureCreateForm() : passiveFeatureEditForm();
    expect(await operation(form)).toMatchObject({ status: "error" }); expect(db.calls).toEqual([]); expect(db.client.rpc).not.toHaveBeenCalled();
  });
  it.each([ok(null), ok([{ id: SYSTEM }, { id: SYSTEM }]), ok({ id: "wrong" }), { data: null, error: { code: "PGRST116" } }])("refuses missing/duplicate/unpublished canonical system without writes", async reply => {
    const db = database([reply]); expect(await createHomebrewPassiveFeatureRecord(passiveFeatureCreateForm())).toMatchObject({ status: "error" }); expect(db.calls).toHaveLength(1);
  });
  it("refuses association/authority/mechanics tampering before queries", async () => {
    const db = database([]); const form = passiveFeatureEditForm(); form.set("class", "forged-other-class"); form.set("effects", "[]");
    expect(await updateHomebrewPassiveFeatureRecord(form)).toMatchObject({ status: "error", fieldErrors: { form: expect.any(Array) } }); expect(db.calls).toEqual([]);
  });
  it("owned list/get apply exact predicates and retain read-only outside-vocabulary association/absence", async () => {
    const db = database([ok({ id: SYSTEM }), ok([passiveFeatureRow(1, { data: extendedFeatureData, effects: extendedFeatureEffects })])]);
    const records = await listOwnedHomebrewPassiveFeatures(); expect(records[0]).toMatchObject({ id: ID, data: { class: "Legacy workshop label / unverified", feature_type: "choice", level: 5 } });
    expect(records[0].data).not.toHaveProperty("subclass"); expect(records[0]).not.toHaveProperty("effects"); expect(records[0].data).not.toHaveProperty("choices");
    expect(db.calls[1].filters).toEqual(filters);
    const get = database([ok({ id: SYSTEM }), ok(passiveFeatureRow())]); await getOwnedHomebrewPassiveFeature(ID); expect(get.calls[1].filters).toEqual([...filters, ["id", ID]]);
  });
  it.each([{ owner_id: SYSTEM }, { system_id: OWNER }, { content_type: "spell" }, { source: "srd" }, { scope: "shared" }, { is_retired: true },
    { data: { ...passiveFeatureData, feature_type: "class_feature" } }, { effects: [{ type: "unknown" }] }])("refuses foreign/unsupported returned data", async override => {
    database([ok({ id: SYSTEM }), ok(passiveFeatureRow(1, override))]); await expect(getOwnedHomebrewPassiveFeature(ID)).rejects.toThrow();
  });
  it("exact read and final CAS update text only, preserving raw mechanics/extensions/effect order/absence", async () => {
    const original = passiveFeatureRow(1, { data: extendedFeatureData, effects: extendedFeatureEffects });
    const merged = { ...extendedFeatureData, description: "  Revised original note.\n" };
    const db = database([ok({ id: SYSTEM }), ok(original), ok(passiveFeatureRow(2, { name: "Revised Cadence", data: merged, effects: extendedFeatureEffects }))]);
    expect(await updateHomebrewPassiveFeatureRecord(passiveFeatureEditForm(1, "Revised Cadence", merged.description))).toEqual({ status: "saved", id: ID, version: 2, operation: "edit" });
    expect(db.calls[1].filters).toEqual([...filters, ["id", ID], ["version", 1]]); expect(db.calls[2].filters).toEqual([["id", ID], ...filters, ["version", 1]]);
    expect(db.calls[2].payload).toEqual({ name: "Revised Cadence", data: merged });
    const raw = (db.calls[2].payload as { data: Record<string, unknown> }).data;
    expect(raw.choices).toBe(extendedFeatureData.choices); expect(raw.unknownLore).toBe(extendedFeatureData.unknownLore); expect(raw).not.toHaveProperty("subclass");
    expect(db.client.rpc).not.toHaveBeenCalled(); expect(db.calls.every(call => call.table === "game_systems" || call.table === "content_definitions")).toBe(true);
  });
  it.each([{ effects: [{ type: "mechanical", stat: "strength", op: "add" }] }, { data: { ...passiveFeatureData, level: 21 } }])("refuses malformed known mechanics/effects BEFORE any update", async override => {
    const db = database([ok({ id: SYSTEM }), ok(passiveFeatureRow(1, override))]);
    expect(await updateHomebrewPassiveFeatureRecord(passiveFeatureEditForm(1, "Changed"))).toMatchObject({ status: "error" });
    expect(db.calls.some(call => call.operation !== "select")).toBe(false); expect(db.client.rpc).not.toHaveBeenCalled();
  });
  it.each([1, FEATURE_VERSION_MAX])("genuine no-op at version%i avoids any update/revision", async version => {
    const db = database([ok({ id: SYSTEM }), ok(passiveFeatureRow(version))]);
    expect(await updateHomebrewPassiveFeatureRecord(passiveFeatureEditForm(version))).toEqual({ status: "unchanged", id: ID, version, message: "No changes to save." });
    expect(db.calls).toHaveLength(2); expect(db.calls.some(call => call.operation === "update")).toBe(false);
  });
  it("refuses changed exhausted version before update", async () => {
    const db = database([ok({ id: SYSTEM }), ok(passiveFeatureRow(FEATURE_VERSION_MAX))]);
    expect(await updateHomebrewPassiveFeatureRecord(passiveFeatureEditForm(FEATURE_VERSION_MAX, "Changed"))).toMatchObject({ status: "error", message: expect.stringContaining("version limit") });
    expect(db.calls.some(call => call.operation === "update")).toBe(false);
  });
  it("classifies a post-read CAS race only through current-owner filters and never retries", async () => {
    const db = database([ok({ id: SYSTEM }), ok(passiveFeatureRow()), ok(null), ok(passiveFeatureRow(2))]);
    expect(await updateHomebrewPassiveFeatureRecord(passiveFeatureEditForm(1, "Changed"))).toMatchObject({ status: "conflict" });
    expect(db.calls.filter(call => call.operation === "update")).toHaveLength(1); expect(db.calls[3].filters).toEqual([...filters, ["id", ID]]);
  });
  it("missing/inaccessible classification does not disclose a foreign row/version", async () => {
    const db = database([ok({ id: SYSTEM }), ok(null), ok(null)]);
    expect(await updateHomebrewPassiveFeatureRecord(passiveFeatureEditForm())).toEqual({ status: "error", message: "This private feature could not be found." });
    expect(db.calls.some(call => call.operation === "update")).toBe(false);
  });
  it.each([ok(null), ok(passiveFeatureRow(2)), ok(passiveFeatureRow(1, { effects: extendedFeatureEffects })), ok(passiveFeatureRow(1, { id: OWNER })),
    ok(passiveFeatureRow(1, { data: featureDataSchema.parse(passiveFeatureData) })), { data: null, error: { code: "timeout" } }])("does not confirm malformed/missing/default-expanded create reply", async reply => {
    database([ok({ id: SYSTEM }), reply]); expect(await createHomebrewPassiveFeatureRecord(passiveFeatureCreateForm())).toMatchObject({ status: "uncertain" });
  });
  it.each([ok(passiveFeatureRow(1, { name: "Changed" })), ok(passiveFeatureRow(2, { name: "Changed", effects: extendedFeatureEffects })),
    ok(passiveFeatureRow(2, { name: "Changed", slug: "substituted" })), { data: null, error: { code: "timeout" } }])("changed update requires exact next version/data/effects/envelope reply", async reply => {
    database([ok({ id: SYSTEM }), ok(passiveFeatureRow()), reply]); expect(await updateHomebrewPassiveFeatureRecord(passiveFeatureEditForm(1, "Changed"))).toMatchObject({ status: "uncertain" });
  });
  it("existing canonical feature/snapshot consumers parse preserved original history independently of edited current row", () => {
    const raw = passiveFeatureRow(1, { data: extendedFeatureData, effects: extendedFeatureEffects });
    const snapshot = { content_id: ID, version: 1, system_id_snapshot: SYSTEM, content_type_snapshot: "feature", slug_snapshot: raw.slug, name_snapshot: raw.name,
      data_snapshot: raw.data, effects_snapshot: raw.effects, source_snapshot: "homebrew", scope_snapshot: "personal", owner_id_snapshot: OWNER };
    const pinned = parseContentVersionSnapshot(snapshot); expect(pinned).toMatchObject({ version: 1, data: { class: extendedFeatureData.class, description: extendedFeatureData.description, choices: extendedFeatureData.choices } });
    expect(parseContentDefinition(passiveFeatureRow(2, { data: { ...extendedFeatureData, description: "Later original note." }, effects: extendedFeatureEffects }))).toMatchObject({ version: 2, data: { description: "Later original note." } });
    expect(parseContentVersionSnapshot(snapshot)).toEqual(pinned); expect(snapshot.data_snapshot).not.toHaveProperty("subclass"); // Parser/synthetic-history control, not actual DB trigger proof.
  });
});
