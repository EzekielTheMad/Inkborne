import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  mapForm: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homebrew/feat-form", () => ({ mapHomebrewFeatFormData: mocks.mapForm }));

import {
  createHomebrewFeatRecord,
  getOwnedHomebrewFeat,
  getOwnedHomebrewFeatCampaignAccess,
  listOwnedHomebrewFeats,
  setHomebrewFeatCampaignShare,
  updateHomebrewFeatRecord,
} from "@/lib/supabase/homebrew-feats-server";
import { featDataSchema } from "@/lib/schemas/content-types/feat";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const FEAT_ID = "33333333-3333-4333-8333-333333333333";

interface DatabaseResponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface QueryCall {
  table: string;
  operation: "select" | "insert" | "update";
  payload?: unknown;
  filters: Array<[string, unknown]>;
  inFilters: Array<[string, unknown[]]>;
  order?: string;
}

function makeClient(
  responses: DatabaseResponse[],
  authenticated = true,
  rpcResponse: DatabaseResponse = { data: null, error: null },
): { client: unknown; calls: QueryCall[] } {
  let responseIndex = 0;
  const calls: QueryCall[] = [];
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(authenticated
        ? { data: { user: { id: USER_ID } }, error: null }
        : { data: { user: null }, error: { message: "missing session" } }),
    },
    from: vi.fn((table: string) => {
      const response = responses[responseIndex++] ?? { data: null, error: null };
      const call: QueryCall = { table, operation: "select", filters: [], inFilters: [] };
      calls.push(call);
      const builder = {
        select: vi.fn(() => builder),
        insert(payload: unknown) { call.operation = "insert"; call.payload = payload; return builder; },
        update(payload: unknown) { call.operation = "update"; call.payload = payload; return builder; },
        eq(column: string, value: unknown) { call.filters.push([column, value]); return builder; },
        in(column: string, values: unknown[]) { call.inFilters.push([column, values]); return builder; },
        order(column: string) { call.order = column; return builder; },
        single: vi.fn().mockResolvedValue(response),
        maybeSingle: vi.fn().mockResolvedValue(response),
        then(resolve: (value: DatabaseResponse) => unknown) { return Promise.resolve(response).then(resolve); },
      };
      return builder;
    }),
    rpc: vi.fn().mockResolvedValue(rpcResponse),
  };
  return { client, calls };
}

const data = featDataSchema.parse({
  description: "Your training gives you a reliable edge.",
  prerequisites: [{ stat: "strength", op: "gte", value: 13 }],
  scores: [1, 0, 0, 0, 0, 0],
  action: "bonus action",
  usages: 2,
  recovery: "long rest",
  extraAC: 1,
});
const effects = [
  { type: "narrative" as const, text: data.description, tag: "Feat" },
  { type: "mechanical" as const, stat: "strength", op: "add" as const, value: 1 },
  { type: "mechanical" as const, stat: "armor_class", op: "add" as const, value: 1 },
];

function row(version = 1) {
  return {
    id: FEAT_ID,
    system_id: SYSTEM_ID,
    content_type: "feat" as const,
    slug: "reliable-training-a1b2c3d4",
    name: "Reliable Training",
    data,
    effects,
    source: "homebrew" as const,
    scope: "personal" as const,
    owner_id: USER_ID,
    version,
    created_at: "2026-07-21T00:00:00.000Z",
    is_retired: false,
  };
}

function form(): FormData {
  return new FormData();
}

function expectFilters(call: QueryCall, expected: Array<[string, unknown]>) {
  for (const filter of expected) expect(call.filters).toContainEqual(filter);
}

function sharedRow(version = 2) {
  return { ...row(version), scope: "shared" as const };
}

function expectInFilter(call: QueryCall, column: string, values: unknown[]) {
  expect(call.inFilters).toContainEqual([column, values]);
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.mapForm.mockReset();
  mocks.mapForm.mockReturnValue({ success: true, data: { name: row().name, data, effects } });
});

describe("homebrew feat reads", () => {
  it("lists active personal or shared feats within the full owner and content boundary", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [row()], error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewFeats()).resolves.toEqual([{
      ...row(),
      sharedCampaignCount: 0,
    }]);
    expectFilters(db.calls[1], [
      ["owner_id", USER_ID], ["system_id", SYSTEM_ID], ["source", "homebrew"],
      ["content_type", "feat"], ["is_retired", false],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
    expect(db.calls[1].order).toBe("name");
  });

  it("does not expose another or malformed feat through the edit read", async () => {
    const malformed = makeClient([]);
    mocks.createClient.mockResolvedValue(malformed.client);
    await expect(getOwnedHomebrewFeat("not-a-uuid")).resolves.toBeNull();
    expect(malformed.calls).toHaveLength(0);

    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(getOwnedHomebrewFeat(FEAT_ID)).resolves.toBeNull();
    expectFilters(db.calls[1], [
      ["id", FEAT_ID], ["owner_id", USER_ID], ["system_id", SYSTEM_ID],
      ["source", "homebrew"], ["content_type", "feat"], ["is_retired", false],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
  });

  it("counts exact campaign shares for shared feat summaries", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [sharedRow()], error: null },
      {
        data: [
          { content_id: FEAT_ID, campaign_id: "44444444-4444-4444-8444-444444444444" },
          { content_id: FEAT_ID, campaign_id: "55555555-5555-4555-8555-555555555555" },
        ],
        error: null,
      },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewFeats()).resolves.toEqual([{
      ...sharedRow(),
      sharedCampaignCount: 2,
    }]);
    expect(db.calls[2].table).toBe("content_shares");
    expectInFilter(db.calls[2], "content_id", [FEAT_ID]);
  });
});

describe("homebrew feat campaign access", () => {
  const CAMPAIGN_ID = "44444444-4444-4444-8444-444444444444";

  it("loads author-manageable same-system campaigns", async () => {
    const db = makeClient([], true, {
      data: [{ id: CAMPAIGN_ID, name: "Tuesday Group", shared: true, eligible: true }],
      error: null,
    });
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewFeatCampaignAccess(FEAT_ID)).resolves.toEqual({
      campaigns: [{ id: CAMPAIGN_ID, name: "Tuesday Group", shared: true, eligible: true }],
      sharedCampaignCount: 1,
    });
    expect((db.client as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "list_owned_content_campaign_access",
      { target_content_id: FEAT_ID },
    );
  });

  it("does not hide campaign RPC failures behind an empty access model", async () => {
    const db = makeClient([], true, {
      data: null,
      error: { code: "42501", message: "not owned" },
    });
    mocks.createClient.mockResolvedValue(db.client);
    await expect(getOwnedHomebrewFeatCampaignAccess(FEAT_ID)).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("passes validated optimistic inputs to the share RPC", async () => {
    const db = makeClient([], true, {
      data: [{
        content_id: FEAT_ID,
        version: 2,
        scope: "shared",
        shared_campaign_count: 1,
      }],
      error: null,
    });
    mocks.createClient.mockResolvedValue(db.client);

    await expect(setHomebrewFeatCampaignShare(FEAT_ID, CAMPAIGN_ID, true, 1))
      .resolves.toEqual({
        contentId: FEAT_ID,
        version: 2,
        scope: "shared",
        sharedCampaignCount: 1,
      });
    expect((db.client as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "set_content_campaign_share",
      {
        target_content_id: FEAT_ID,
        target_campaign_id: CAMPAIGN_ID,
        enabled: true,
        expected_version: 1,
      },
    );
  });

  it("maps stale share mutations and rejects malformed input", async () => {
    const stale = makeClient([], true, {
      data: null,
      error: { code: "40001", message: "stale version" },
    });
    mocks.createClient.mockResolvedValue(stale.client);
    await expect(setHomebrewFeatCampaignShare(FEAT_ID, CAMPAIGN_ID, false, 1))
      .resolves.toMatchObject({ status: "conflict" });

    const malformed = makeClient([]);
    mocks.createClient.mockResolvedValue(malformed.client);
    await expect(setHomebrewFeatCampaignShare("bad", CAMPAIGN_ID, true, 1))
      .resolves.toMatchObject({ status: "error" });
    expect((malformed.client as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });
});

describe("createHomebrewFeatRecord", () => {
  it("derives and validates the immutable personal-homebrew envelope server-side", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: row(), error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    const input = form();
    input.set("system_id", "attacker-system");
    input.set("content_type", "spell");
    input.set("source", "srd");
    input.set("scope", "platform");
    input.set("owner_id", "attacker");
    input.set("version", "99");
    input.set("data", '{"untrusted":true}');
    input.set("effects", '[{"type":"grant"}]');

    await expect(createHomebrewFeatRecord(input)).resolves.toEqual(row());
    expect(mocks.mapForm).toHaveBeenCalledWith(input);
    expect(db.calls[1].payload).toEqual(expect.objectContaining({
      system_id: SYSTEM_ID,
      content_type: "feat",
      name: row().name,
      data,
      effects,
      source: "homebrew",
      scope: "personal",
      owner_id: USER_ID,
    }));
    expect(db.calls[1].payload).not.toHaveProperty("version");
    expect((db.calls[1].payload as { slug: string }).slug).toMatch(/^reliable-training-[0-9a-f]{8}$/);
  });

  it("returns mapper validation without querying content tables", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);
    mocks.mapForm.mockReturnValue({ success: false, fieldErrors: { name: ["Name is required."] } });

    await expect(createHomebrewFeatRecord(form())).resolves.toMatchObject({
      status: "error", fieldErrors: { name: ["Name is required."] },
    });
    expect(db.calls).toHaveLength(0);
  });

  it("rejects malformed derived effects before writing", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);
    mocks.mapForm.mockReturnValue({
      success: true,
      data: { name: row().name, data, effects: [{ type: "mechanical", stat: "strength", op: "add" }] },
    });

    await expect(createHomebrewFeatRecord(form())).resolves.toMatchObject({
      status: "error", message: "The feat contains unsupported structured data.",
    });
    expect(db.calls).toHaveLength(0);
  });

  it("does not create a feat for a signed-out caller", async () => {
    const db = makeClient([], false);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewFeatRecord(form())).resolves.toEqual({
      status: "error", message: "Sign in before creating a homebrew feat.",
    });
    expect(mocks.mapForm).not.toHaveBeenCalled();
  });
});

describe("updateHomebrewFeatRecord", () => {
  it("uses optimistic versioning and every immutable ownership filter", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: row(4), error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(updateHomebrewFeatRecord(FEAT_ID, 3, form())).resolves.toEqual(row(4));
    expect(db.calls[1].operation).toBe("update");
    expect(db.calls[1].payload).toEqual({ name: row().name, data, effects });
    expectFilters(db.calls[1], [
      ["id", FEAT_ID], ["owner_id", USER_ID], ["system_id", SYSTEM_ID],
      ["source", "homebrew"], ["content_type", "feat"],
      ["is_retired", false], ["version", 3],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
  });

  it("distinguishes a stale version from a missing or unauthorized feat", async () => {
    const stale = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
      { data: { id: FEAT_ID, version: 4 }, error: null },
    ]);
    mocks.createClient.mockResolvedValue(stale.client);
    await expect(updateHomebrewFeatRecord(FEAT_ID, 3, form())).resolves.toEqual({
      status: "conflict", message: "This feat changed in another session. Reload it before saving again.",
    });
    expectFilters(stale.calls[2], [
      ["id", FEAT_ID], ["owner_id", USER_ID], ["system_id", SYSTEM_ID],
      ["source", "homebrew"], ["content_type", "feat"], ["is_retired", false],
    ]);
    expectInFilter(stale.calls[2], "scope", ["personal", "shared"]);

    const missing = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(missing.client);
    await expect(updateHomebrewFeatRecord(FEAT_ID, 3, form())).resolves.toEqual({
      status: "error", message: "This homebrew feat could not be found.",
    });
  });

  it("rejects malformed identity only after authenticating", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewFeatRecord("bad", 0, form())).resolves.toEqual({
      status: "error", message: "The feat identifier or version is invalid.",
    });
    expect(db.calls).toHaveLength(0);
  });
});
