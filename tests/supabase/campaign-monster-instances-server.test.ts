import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/campaigns/monster-instance-schema", async (original) => ({ ...(await original<typeof import("@/lib/campaigns/monster-instance-schema")>()), CAMPAIGN_MONSTERS_ENABLED: true }));
import { campaignMonsterContext, commitCampaignMonsterInstance, getCampaignMonsterInstance, listCampaignMonsterInstances, listCampaignMonsterSources, previewCampaignMonsterSource, resolveCampaignMonsterInstance } from "@/lib/supabase/campaign-monster-instances-server";
import { instanceIntentForm } from "@/lib/campaigns/monster-instance-form";
import { MC, monsterCreate, monsterDetail, monsterPreview, monsterReceipt } from "@/tests/fixtures/campaign-monster-instances";
const campaign = { id: MC.campaign, name: "Original bridge", owner_id: MC.owner, system_id: MC.system };
function database(replies: unknown[] = [campaign, { id: MC.system }], rpcData?: unknown, rpcError: null | { code: string } = null,
  user: { id: string; is_anonymous?: boolean } | null = { id: MC.owner }) {
  const calls: { table: string; filters: unknown[][] }[] = [];
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
    from(table: string) {
      const value = replies.shift(); const call = { table, filters: [] as unknown[][] }; calls.push(call);
      const query = { select() { return query; }, eq(key: string, value: unknown) { call.filters.push([key, value]); return query; },
        or(value: string) { call.filters.push(["or", value]); return query; }, ilike(key: string, value: string) { call.filters.push(["ilike", key, value]); return query; },
        order(key: string) { call.filters.push(["order", key]); return query; }, limit(value: number) { call.filters.push(["limit", value]); return query; },
        maybeSingle: () => Promise.resolve({ data: value, error: null }), single: () => Promise.resolve({ data: value, error: null }),
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: value, error: null }).then(resolve); } };
      return query;
    } };
  mocks.createClient.mockResolvedValue(client); return { client, calls };
}
beforeEach(() => vi.clearAllMocks());
describe("campaign monster DAL: mocked transport/query proof only", () => {
  it.each([null, { id: MC.owner, is_anonymous: true }, { id: "invalid" }])("denies missing/anonymous/invalid identity before queries", async (user) => {
    const db = database([], null, null, user); expect(await campaignMonsterContext(MC.campaign)).toBeNull(); expect(db.calls).toEqual([]); expect(db.client.rpc).not.toHaveBeenCalled();
  });
  it("denies non-owner dm-labelled/campaign/system mismatch before RPC", async () => {
    const foreign = database([{ ...campaign, owner_id: MC.foreign, role: "dm" }]);
    expect(await commitCampaignMonsterInstance(MC.campaign, instanceIntentForm(monsterCreate()))).toMatchObject({ status: "error" }); expect(foreign.client.rpc).not.toHaveBeenCalled();
    database([campaign, { id: MC.foreign }]); await expect(previewCampaignMonsterSource(MC.campaign, MC.source, 1)).rejects.toThrow(/system/);
  });
  it("sends ONE strict intent RPC, never direct instance/receipt/content/character writes", async () => {
    const db = database([campaign, { id: MC.system }], monsterReceipt()); const intent = monsterCreate();
    expect(await commitCampaignMonsterInstance(MC.campaign, instanceIntentForm(intent))).toEqual({ status: "saved", receipt: monsterReceipt() });
    expect(db.client.rpc).toHaveBeenCalledExactlyOnceWith("commit_campaign_monster_instance_v1", { target_campaign_id: MC.campaign, request: intent });
    expect(db.calls.map((c) => c.table)).toEqual(["campaigns"]); expect(db.calls[0].filters).toEqual([["id", MC.campaign], ["owner_id", MC.owner]]);
  });
  it("rejects duplicate/File controls before context or mutation", async () => {
    const form = instanceIntentForm(monsterCreate()); form.append("intent", "{}");
    expect(await commitCampaignMonsterInstance(MC.campaign, form)).toMatchObject({ status: "error" }); expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it.each([undefined, null, { ...monsterReceipt(), operation_id: MC.foreign }, { ...monsterReceipt(), canonical_intent: { ...monsterCreate(), name: "Tampered" } }])("never confirms malformed/foreign returned receipt", async (reply) => {
    database([campaign, { id: MC.system }], reply); expect(await commitCampaignMonsterInstance(MC.campaign, instanceIntentForm(monsterCreate()))).toMatchObject({ status: "uncertain" });
  });
  it("keeps native RPC errors distinct from missing receipt, conservatively uncertain except definite transaction conflict", async () => {
    database([campaign, { id: MC.system }], null, { code: "40001" }); expect(await commitCampaignMonsterInstance(MC.campaign, instanceIntentForm(monsterCreate()))).toMatchObject({ status: "conflict" });
    database([campaign, { id: MC.system }], null, { code: "42501" }); expect(await resolveCampaignMonsterInstance(MC.campaign, MC.operation)).toMatchObject({ status: "uncertain" });
    const db = database([campaign, { id: MC.system }], { status: "absent" });
    expect(await resolveCampaignMonsterInstance(MC.campaign, MC.operation)).toEqual({ status: "absent" });
    expect(db.client.rpc).toHaveBeenCalledWith("resolve_campaign_monster_command_v1", { target_campaign_id: MC.campaign, target_operation_id: MC.operation });
  });
  it("receipt recovery bypasses fresh published-system/source queries", async () => {
    const db = database([campaign], { status: "saved", receipt: monsterReceipt() });
    expect(await resolveCampaignMonsterInstance(MC.campaign, MC.operation)).toMatchObject({ status: "saved" });
    expect(db.calls.map((call) => call.table)).toEqual(["campaigns"]);
  });
  it("preserves exact text revision and list metadata without snapshot/notes", async () => {
    const detail = monsterDetail("9007199254740993"); const summary = { id: detail.id, campaign_id: detail.campaign_id, name: detail.name, current_hp: detail.current_hp,
      declared_max_hp: detail.declared_max_hp, archived: detail.archived, revision: detail.revision };
    const db = database([campaign, { id: MC.system }], [summary]);
    expect(await listCampaignMonsterInstances(MC.campaign, false, "bridge", 0)).toEqual([summary]);
    expect(db.client.rpc).toHaveBeenCalledWith("list_campaign_monster_instances_v1", { target_campaign_id: MC.campaign, show_archived: false, name_search: "bridge", page_number: 0 });
    database([campaign, { id: MC.system }], [{ ...summary, revision: 9007199254740992 }]); await expect(listCampaignMonsterInstances(MC.campaign, false, "", 0)).rejects.toThrow();
  });
  it("detail validates immutable source identity/full canonical data before exposing owner props", async () => {
    const detail = monsterDetail(); database([campaign, { id: MC.system }], detail); expect(await getCampaignMonsterInstance(MC.campaign, MC.instance)).toEqual(detail);
    database([campaign, { id: MC.system }], { ...detail, source_snapshot: { ...(detail.source_snapshot as object), effects_snapshot: [{ type: "unknown" }] } });
    await expect(getCampaignMonsterInstance(MC.campaign, MC.instance)).rejects.toThrow();
  });
  it("preview validates returned exact source/version/HP and blocks descriptive corruption", async () => {
    database([campaign, { id: MC.system }], monsterPreview()); expect(await previewCampaignMonsterSource(MC.campaign, MC.source, 1)).toEqual(monsterPreview());
    database([campaign, { id: MC.system }], { ...monsterPreview(), declared_max_hp: 18 }); await expect(previewCampaignMonsterSource(MC.campaign, MC.source, 1)).rejects.toThrow();
  });
  it("source picker excludes shared/cross-owner scope with bounded stable order/search", async () => {
    const db = database([campaign, { id: MC.system }, [{ id: MC.source, name: "Original", version: 1 }]]);
    expect(await listCampaignMonsterSources(MC.campaign, "%_")).toHaveLength(1);
    expect(db.calls[2].filters).toContainEqual(["or", `scope.eq.platform,and(scope.eq.personal,owner_id.eq.${MC.owner})`]);
    expect(db.calls[2].filters).toContainEqual(["ilike", "name", "%\\%\\_%"]); expect(db.calls[2].filters).toContainEqual(["limit", 100]);
  });
  it.each([null, undefined, false, 0, ""])("refuses malformed successful source array %s rather than false empty", async (raw) => {
    database([campaign, { id: MC.system }, raw]); await expect(listCampaignMonsterSources(MC.campaign)).rejects.toThrow();
  });
  it("genuine successful empty source array remains empty", async () => {
    database([campaign, { id: MC.system }, []]); expect(await listCampaignMonsterSources(MC.campaign)).toEqual([]);
  });
  it.each([undefined, false, 0, ""])("refuses malformed successful detail %s rather than false not-found", async (raw) => {
    database([campaign], raw); await expect(getCampaignMonsterInstance(MC.campaign, MC.instance)).rejects.toThrow();
  });
  it("only explicit native null means no owned instance; valid positive detail remains admitted", async () => {
    database([campaign], null); expect(await getCampaignMonsterInstance(MC.campaign, MC.instance)).toBeNull();
    database([campaign], monsterDetail()); expect(await getCampaignMonsterInstance(MC.campaign, MC.instance)).toEqual(monsterDetail());
  });
});
