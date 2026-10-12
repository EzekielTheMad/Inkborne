import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  mapForm: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homebrew/item-form", () => ({
  mapHomebrewItemFormData: mocks.mapForm,
}));

import {
  createHomebrewItemRecord,
  getOwnedHomebrewItem,
  listOwnedHomebrewItems,
  updateHomebrewItemRecord,
  getHomebrewItemCampaignAccess,
  setHomebrewItemCampaignShare,
} from "@/lib/supabase/homebrew-items-server";
import { itemDataSchema } from "@/lib/schemas/content-types/item";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

interface DatabaseResponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface QueryCall {
  table: string;
  operation: "select" | "insert" | "update";
  payload?: unknown;
  filters: Array<[string, unknown]>;
  orders: string[];
}

function makeClient(responses: DatabaseResponse[], authenticated = true) {
  let responseIndex = 0;
  const calls: QueryCall[] = [];
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      const response = responses[responseIndex++] ?? { data: null, error: null };
      const call: QueryCall = {
        table,
        operation: "select",
        filters: [],
        orders: [],
      };
      calls.push(call);
      const builder = {
        select: vi.fn(() => builder),
        insert(payload: unknown) {
          call.operation = "insert";
          call.payload = payload;
          return builder;
        },
        update(payload: unknown) {
          call.operation = "update";
          call.payload = payload;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        in(column: string, value: unknown[]) { call.filters.push([column, value]); return builder; },
        order(column: string) {
          call.orders.push(column);
          return builder;
        },
        single: vi.fn().mockResolvedValue(response),
        maybeSingle: vi.fn().mockResolvedValue(response),
        then(resolve: (value: DatabaseResponse) => unknown) {
          return Promise.resolve(response).then(resolve);
        },
      };
      return builder;
    }),
  };
  if (!authenticated) {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  }
  return { client, calls };
}

function expectFilters(call: QueryCall, filters: Array<[string, unknown]>) {
  expect(call.filters).toEqual(expect.arrayContaining(filters));
}

const data = itemDataSchema.parse({
  description: "A compass that points toward the last promise you made.",
  equipment_category: "Adventuring Gear",
  cost: { quantity: 2.5, unit: "gp" },
  weight: 1.5,
});

describe("item shared-scope owner and received RPC boundaries (transport mocked)", () => {
  const campaignId = "44444444-4444-4444-8444-444444444444";
  const success = { content_id: ITEM_ID, version: 2, scope: "shared", shared_campaign_count: 1 };
  function sharingClient(reply: DatabaseResponse, authenticated = true) {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }], authenticated);
    const rpc = vi.fn().mockResolvedValue(reply);
    mocks.createClient.mockResolvedValue({ ...db.client, rpc });
    return { ...db, rpc };
  }
  it("loads an actual shared owned item while preserving exact owner/system/type/source/active filters", async () => {
    const shared = { ...row(2), scope: "shared" }, db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: shared, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    expect(await getOwnedHomebrewItem(ITEM_ID)).toEqual(shared);
    expectFilters(db.calls[1], [["id", ITEM_ID], ["owner_id", USER_ID], ["system_id", SYSTEM_ID], ["content_type", "item"], ["source", "homebrew"], ["is_retired", false], ["scope", ["personal", "shared"]]]);
  });
  it("retains shared item effects and version CAS on metadata updates", async () => {
    const shared = { ...row(3), scope: "shared", effects: [{ type: "narrative", text: "Original retained effect." }] };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: shared, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    expect(await updateHomebrewItemRecord(ITEM_ID, 2, new FormData())).toEqual(shared);
    expect(db.calls[1].payload).toEqual({ name: row().name, data });
    expectFilters(db.calls[1], [["version", 2], ["scope", ["personal", "shared"]]]);
  });
  it("calls exactly one sharing RPC, accepting its written version without any later current-row read", async () => {
    const db = sharingClient({ data: [success], error: null });
    expect(await setHomebrewItemCampaignShare(ITEM_ID, campaignId, true, 1)).toEqual({ contentId: ITEM_ID, version: 2, scope: "shared", sharedCampaignCount: 1 });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("set_content_campaign_share", { target_content_id: ITEM_ID, target_campaign_id: campaignId, enabled: true, expected_version: 1 });
    expect(db.calls).toHaveLength(1); expect(db.calls[0].table).toBe("game_systems");
    expectFilters(db.calls[0], [["slug", "dnd-5e-2014"], ["status", "published"]]);
  });
  it.each([0, -1, 1.5, 2147483648, NaN])("refuses invalid PG version %s before RPC", async version => {
    const db = sharingClient({ data: [success], error: null });
    expect(await setHomebrewItemCampaignShare(ITEM_ID, campaignId, true, version)).toMatchObject({ status: "error" });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("refuses signed-out requests before system or RPC reads", async () => {
    const db = sharingClient({ data: [success], error: null }, false);
    expect(await setHomebrewItemCampaignShare(ITEM_ID, campaignId, true, 1)).toMatchObject({ status: "error" });
    expect(db.rpc).not.toHaveBeenCalled(); expect(db.calls).toEqual([]);
  });
  it.each([null, [], [success, success], { ...success }, [{ ...success, content_id: campaignId }], [{ ...success, version: 4 }],
    [{ ...success, version: 2147483648 }], [{ ...success, shared_campaign_count: 0 }], [{ ...success, scope: "personal" }], [{ ...success, unreviewed: true }]])("keeps malformed or uncorrelated received result %j uncertain with no retry", async value => {
    const db = sharingClient({ data: value, error: null });
    expect(await setHomebrewItemCampaignShare(ITEM_ID, campaignId, true, 1)).toMatchObject({ status: "uncertain" }); expect(db.rpc).toHaveBeenCalledOnce();
  });
  it.each([["40001", "conflict"], ["42501", "error"], ["22003", "error"], ["23514", "error"], ["FETCH_ERROR", "uncertain"]])("classifies %s as %s without response detail disclosure", async (code, status) => {
    const db = sharingClient({ data: null, error: { code, message: "Private provider detail" } });
    const result = await setHomebrewItemCampaignShare(ITEM_ID, campaignId, true, 1);
    expect(result).toMatchObject({ status }); expect(JSON.stringify(result)).not.toContain("Private provider"); expect(db.rpc).toHaveBeenCalledOnce();
  });
  it("keeps thrown lost responses uncertain and never retries", async () => {
    const db = sharingClient({ data: [success], error: null }); db.rpc.mockRejectedValue(Error("lost response"));
    expect(await setHomebrewItemCampaignShare(ITEM_ID, campaignId, true, 1)).toMatchObject({ status: "uncertain" }); expect(db.rpc).toHaveBeenCalledOnce();
  });
  it.each([{ version: 2, scope: "shared", shared_campaign_count: 2 }, { version: 3, scope: "personal", shared_campaign_count: 0 }, { version: 2147483647, scope: "shared", shared_campaign_count: 2 }])("accepts intermediate/final/max no-op written result %j", async result => {
    const db = sharingClient({ data: [{ content_id: ITEM_ID, ...result }], error: null });
    const expected = result.version === 2147483647 ? result.version : 2;
    expect(await setHomebrewItemCampaignShare(ITEM_ID, campaignId, false, expected)).toEqual({ contentId: ITEM_ID, version: result.version, scope: result.scope, sharedCampaignCount: result.shared_campaign_count });
    expect(db.calls).toHaveLength(1); // Final revoke does not read newly private snapshot as the campaign owner.
  });
  it.each([null, [{ id: campaignId, name: "Original Group", shared: true, eligible: false }, { id: campaignId, name: "Duplicate", shared: false, eligible: true }]])("rejects unavailable/duplicate campaign projection instead of inventing empty %j", async access => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(2), error: null }]);
    const rpc = vi.fn().mockResolvedValue({ data: access, error: null, count: Array.isArray(access) ? access.length : null }); mocks.createClient.mockResolvedValue({ ...db.client, rpc });
    await expect(getHomebrewItemCampaignAccess(ITEM_ID)).rejects.toThrow();
  });
  it("keeps former-member actual shares removable in complete projection", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(2), error: null }]);
    const campaigns = [{ id: campaignId, name: "Original Group", shared: true, eligible: false }];
    const rpc = vi.fn().mockResolvedValue({ data: campaigns, error: null, count: 1 }); mocks.createClient.mockResolvedValue({ ...db.client, rpc });
    expect(await getHomebrewItemCampaignAccess(ITEM_ID)).toEqual({ campaigns, sharedCampaignCount: 1 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("list_owned_content_campaign_access", { target_content_id: ITEM_ID }, { count: "exact" });
  });
  it.each([null, 2])("rejects missing or truncated authoritative option count %s", async count => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(2), error: null }]);
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: campaignId, name: "Original Group", shared: true, eligible: true }], error: null, count });
    mocks.createClient.mockResolvedValue({ ...db.client, rpc });
    await expect(getHomebrewItemCampaignAccess(ITEM_ID)).rejects.toThrow("Complete campaign access projection");
  });
});

function row(version = 1) {
  return {
    id: ITEM_ID,
    system_id: SYSTEM_ID,
    content_type: "item" as const,
    slug: "oathbound-compass-a1b2c3d4",
    name: "Oathbound Compass",
    data,
    effects: [],
    source: "homebrew" as const,
    scope: "personal" as const,
    owner_id: USER_ID,
    version,
    created_at: "2026-08-31T00:00:00.000Z",
    is_retired: false,
  };
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.mapForm.mockReset();
  mocks.mapForm.mockReturnValue({
    success: true,
    data: { name: row().name, data },
  });
});

describe("createHomebrewItemRecord", () => {
  it("derives the immutable private item envelope and ignores forged fields", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: row(), error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    const input = new FormData();
    input.set("owner_id", "attacker");
    input.set("system_id", "attacker-system");
    input.set("content_type", "spell");
    input.set("source", "srd");
    input.set("scope", "platform");
    input.set("effects", '[{"type":"grant"}]');
    input.set("version", "99");

    await expect(createHomebrewItemRecord(input)).resolves.toEqual(row());
    expect(mocks.mapForm).toHaveBeenCalledWith(input);
    expect(db.calls[1].payload).toEqual(expect.objectContaining({
      system_id: SYSTEM_ID,
      content_type: "item",
      name: row().name,
      data,
      effects: [],
      source: "homebrew",
      scope: "personal",
      owner_id: USER_ID,
    }));
    expect(db.calls[1].payload).not.toHaveProperty("version");
    expect((db.calls[1].payload as { slug: string }).slug).toMatch(
      /^oathbound-compass-[0-9a-f]{8}$/,
    );
    expectFilters(db.calls[0], [
      ["slug", "dnd-5e-2014"],
      ["status", "published"],
    ]);
  });

  it("authenticates before mutation and returns a constrained signed-out error", async () => {
    const db = makeClient([], false);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(createHomebrewItemRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "Sign in before creating a homebrew item.",
    });
    expect(mocks.mapForm).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("returns named validation without resolving persistence context", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);
    mocks.mapForm.mockReturnValue({
      success: false,
      fieldErrors: { name: ["Name is required."] },
    });

    await expect(createHomebrewItemRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { name: ["Name is required."] },
    });
    expect(db.calls).toEqual([]);
  });

  it("does not expose database error details", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: { code: "XX000", message: "private database detail" } },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(createHomebrewItemRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "The item could not be saved. Please try again.",
    });
  });
});

describe("owned homebrew item reads", () => {
  it("lists only the current owner's active private items", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [row()], error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewItems()).resolves.toEqual([row()]);
    expectFilters(db.calls[1], [
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "item"],
      ["scope", ["personal", "shared"]],
      ["is_retired", false],
    ]);
    expect(db.calls[1].orders).toEqual(["name"]);
  });

  it("rejects invalid UUIDs before any table lookup", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewItem("not-a-uuid")).resolves.toBeNull();
    expect(db.calls).toEqual([]);
  });

  it("constrains a load by owner, type, source, scope, system, and retirement", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewItem(ITEM_ID)).resolves.toBeNull();
    expectFilters(db.calls[1], [
      ["id", ITEM_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "item"],
      ["scope", ["personal", "shared"]],
      ["is_retired", false],
    ]);
  });
});

describe("updateHomebrewItemRecord", () => {
  it("rejects signed-out updates before parsing or persistence", async () => {
    const db = makeClient([], false);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewItemRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(mocks.mapForm).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("returns unavailable for another owner's, retired, or non-item identity without disclosure", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewItemRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({
      status: "error", message: "This homebrew item could not be found.",
    });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
    expect(db.calls[2].filters).toEqual(db.calls[1].filters.filter(([key]) => key !== "version"));
  });

  it("hides conflict lookup errors and never retries the mutation", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
      { data: null, error: { code: "XX000", message: "Sensitive detail" } },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewItemRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({
      status: "error", message: "The item could not be saved. Please try again.",
    });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
  });

  it("saves a new immutable version only against the expected current version", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: row(2), error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(
      updateHomebrewItemRecord(ITEM_ID, 1, new FormData()),
    ).resolves.toEqual(row(2));
    expect(db.calls[1].operation).toBe("update");
    expect(db.calls[1].payload).toEqual({ name: row().name, data });
    expectFilters(db.calls[1], [
      ["id", ITEM_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "item"],
      ["scope", ["personal", "shared"]],
      ["is_retired", false],
      ["version", 1],
    ]);
  });

  it("preserves existing mechanical effects when saving ordinary item metadata", async () => {
    const effects = [{ type: "mechanical", stat: "speed.walk", op: "add", value: 5 }];
    const saved = { ...row(2), effects };
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: saved, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    const input = new FormData();
    input.set("effects", "[]");

    await expect(updateHomebrewItemRecord(ITEM_ID, 1, input)).resolves.toEqual(saved);
    expect(db.calls[1].payload).toEqual({ name: row().name, data });
    expect(db.calls[1].payload).not.toHaveProperty("effects");
  });

  it("returns a friendly conflict without retrying a stale overwrite", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
      { data: { id: ITEM_ID, version: 2 }, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(
      updateHomebrewItemRecord(ITEM_ID, 1, new FormData()),
    ).resolves.toEqual({
      status: "conflict",
      message:
        "This item changed in another session. Reload it before saving again.",
    });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
    expectFilters(db.calls[2], [
      ["id", ITEM_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "item"],
      ["scope", ["personal", "shared"]],
      ["is_retired", false],
    ]);
  });

  it("rejects malformed identity without touching the database", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(
      updateHomebrewItemRecord("not-a-uuid", 0, new FormData()),
    ).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toEqual([]);
  });
});

describe("item persistence runtime validation", () => {
  it("requires a single published system before writing", async () => {
    const db = makeClient([{ data: null, error: { code: "PGRST116" } }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewItemRecord(new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toHaveLength(1);
  });

  it("rejects malformed returned cost data instead of claiming a saved item", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: { ...row(), data: { ...data, cost: { quantity: -1, unit: "gp" } } }, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewItemRecord(new FormData())).resolves.toMatchObject({ status: "error" });
  });
});

describe("unchanged private-create and unavailable sharing system", () => {
  it("does not admit a shared create response when creation derives personal", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: { ...row(), scope: "shared" }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    expect(await createHomebrewItemRecord(new FormData())).toMatchObject({ status: "error" });
    expect(db.calls[1].payload).toMatchObject({ scope: "personal", effects: [] });
  });
  it.each([{ data: null, error: null }, { data: null, error: { code: "PGRST116" } }, { data: [], error: null }])("refuses missing/duplicate/invalid canonical system %j before sharing", async response => {
    const db = makeClient([response]), rpc = vi.fn(); mocks.createClient.mockResolvedValue({ ...db.client, rpc });
    expect(await setHomebrewItemCampaignShare(ITEM_ID, "44444444-4444-4444-8444-444444444444", true, 1)).toMatchObject({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
