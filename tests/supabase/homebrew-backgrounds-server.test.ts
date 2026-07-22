import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  mapForm: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homebrew/background-form", () => ({
  mapHomebrewBackgroundFormData: mocks.mapForm,
}));

import {
  createHomebrewBackgroundRecord,
  getOwnedHomebrewBackground,
  getHomebrewBackgroundCampaignAccess,
  listOwnedHomebrewBackgrounds,
  setHomebrewBackgroundCampaignShare,
  updateHomebrewBackgroundRecord,
} from "@/lib/supabase/homebrew-backgrounds-server";
import { backgroundDataSchema } from "@/lib/schemas/content-types/background";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const BACKGROUND_ID = "33333333-3333-4333-8333-333333333333";
const CAMPAIGN_ID = "44444444-4444-4444-8444-444444444444";

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
      getUser: vi.fn().mockResolvedValue(
        authenticated
          ? { data: { user: { id: USER_ID } }, error: null }
          : {
              data: { user: null },
              error: { message: "missing session" },
            },
      ),
    },
    from: vi.fn((table: string) => {
      const response = responses[responseIndex++] ?? {
        data: null,
        error: null,
      };
      const call: QueryCall = {
        table,
        operation: "select",
        filters: [],
        inFilters: [],
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
        in(column: string, values: unknown[]) {
          call.inFilters.push([column, values]);
          return builder;
        },
        order(column: string) {
          call.order = column;
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
    rpc: vi.fn().mockResolvedValue(rpcResponse),
  };
  return { client, calls };
}

const data = backgroundDataSchema.parse({
  feature: {
    name: "Lantern Network",
    description: "Friendly guides can help you find safe passage.",
  },
  personality_traits: ["I always leave a light for travelers."],
  ideals: [{ text: "No one should travel alone.", alignment: "Good" }],
  bonds: ["My old route is still my home."],
  flaws: ["I trust travelers too quickly."],
  skills: ["insight", "survival"],
  gold: 10,
  languageProfs: ["elvish"],
  toolProfs: ["cartographer's tools"],
  equipment: "A hooded lantern and a traveler's map",
  variant: null,
  source_refs: [],
});

const effects = [
  {
    type: "narrative" as const,
    text: data.feature.description,
    tag: data.feature.name,
  },
  { type: "grant" as const, stat: "skill_proficiency", value: "insight" },
  { type: "grant" as const, stat: "skill_proficiency", value: "survival" },
];

function row(version = 1) {
  return {
    id: BACKGROUND_ID,
    system_id: SYSTEM_ID,
    content_type: "background" as const,
    slug: "lantern-guide-a1b2c3d4",
    name: "Lantern Guide",
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

function sharedRow(version = 2) {
  return { ...row(version), scope: "shared" as const };
}

function form(): FormData {
  return new FormData();
}

function expectFilters(call: QueryCall, expected: Array<[string, unknown]>) {
  for (const filter of expected) expect(call.filters).toContainEqual(filter);
}

function expectInFilter(call: QueryCall, column: string, values: unknown[]) {
  expect(call.inFilters).toContainEqual([column, values]);
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.mapForm.mockReset();
  mocks.mapForm.mockReturnValue({
    success: true,
    data: { name: row().name, data, effects },
  });
});

describe("homebrew background reads", () => {
  it("lists active personal or shared backgrounds inside the full owner boundary", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [row()], error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewBackgrounds()).resolves.toEqual([
      { ...row(), sharedCampaignCount: 0 },
    ]);
    expectFilters(db.calls[1], [
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "background"],
      ["is_retired", false],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
    expect(db.calls[1].order).toBe("name");
  });

  it("counts exact campaign shares for shared background summaries", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [sharedRow()], error: null },
      {
        data: [
          { content_id: BACKGROUND_ID, campaign_id: CAMPAIGN_ID },
          {
            content_id: BACKGROUND_ID,
            campaign_id: "55555555-5555-4555-8555-555555555555",
          },
        ],
        error: null,
      },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewBackgrounds()).resolves.toEqual([
      { ...sharedRow(), sharedCampaignCount: 2 },
    ]);
    expect(db.calls[2].table).toBe("content_shares");
    expectInFilter(db.calls[2], "content_id", [BACKGROUND_ID]);
  });

  it("does not expose another or malformed background through the edit read", async () => {
    const malformed = makeClient([]);
    mocks.createClient.mockResolvedValue(malformed.client);
    await expect(getOwnedHomebrewBackground("not-a-uuid")).resolves.toBeNull();
    expect(malformed.calls).toHaveLength(0);

    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(getOwnedHomebrewBackground(BACKGROUND_ID)).resolves.toBeNull();
    expectFilters(db.calls[1], [
      ["id", BACKGROUND_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "background"],
      ["is_retired", false],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
  });

  it("rejects malformed persisted background content", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      {
        data: [{ ...row(), data: { feature: null } }],
        error: null,
      },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewBackgrounds()).rejects.toThrow(
      "The database returned invalid homebrew background content.",
    );
  });
});

describe("homebrew background campaign access", () => {
  it("loads author-manageable campaigns through the generic access RPC", async () => {
    const db = makeClient([], true, {
      data: [
        {
          id: CAMPAIGN_ID,
          name: "Tuesday Group",
          shared: true,
          eligible: true,
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue(db.client);

    await expect(
      getHomebrewBackgroundCampaignAccess(BACKGROUND_ID),
    ).resolves.toEqual({
      campaigns: [
        {
          id: CAMPAIGN_ID,
          name: "Tuesday Group",
          shared: true,
          eligible: true,
        },
      ],
      sharedCampaignCount: 1,
    });
    expect((db.client as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "list_owned_content_campaign_access",
      { target_content_id: BACKGROUND_ID },
    );
  });

  it("passes validated optimistic inputs to the generic share RPC", async () => {
    const db = makeClient([], true, {
      data: [
        {
          content_id: BACKGROUND_ID,
          version: 2,
          scope: "shared",
          shared_campaign_count: 1,
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue(db.client);

    await expect(
      setHomebrewBackgroundCampaignShare(
        BACKGROUND_ID,
        CAMPAIGN_ID,
        true,
        1,
      ),
    ).resolves.toEqual({
      contentId: BACKGROUND_ID,
      version: 2,
      scope: "shared",
      sharedCampaignCount: 1,
    });
    expect((db.client as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "set_content_campaign_share",
      {
        target_content_id: BACKGROUND_ID,
        target_campaign_id: CAMPAIGN_ID,
        enabled: true,
        expected_version: 1,
      },
    );
  });

  it("maps stale mutations and safely rejects malformed RPC rows", async () => {
    const stale = makeClient([], true, {
      data: null,
      error: { code: "40001", message: "stale version" },
    });
    mocks.createClient.mockResolvedValue(stale.client);
    await expect(
      setHomebrewBackgroundCampaignShare(
        BACKGROUND_ID,
        CAMPAIGN_ID,
        false,
        1,
      ),
    ).resolves.toMatchObject({ status: "conflict" });

    const malformed = makeClient([], true, {
      data: [{ content_id: "wrong" }],
      error: null,
    });
    mocks.createClient.mockResolvedValue(malformed.client);
    await expect(
      setHomebrewBackgroundCampaignShare(
        BACKGROUND_ID,
        CAMPAIGN_ID,
        true,
        1,
      ),
    ).resolves.toEqual({
      status: "error",
      message: "Campaign access could not be updated. Please try again.",
    });
  });
});

describe("createHomebrewBackgroundRecord", () => {
  it("derives the immutable personal-homebrew envelope server-side", async () => {
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

    await expect(createHomebrewBackgroundRecord(input)).resolves.toEqual(row());
    expect(mocks.mapForm).toHaveBeenCalledWith(input);
    expect(db.calls[1].payload).toEqual(
      expect.objectContaining({
        system_id: SYSTEM_ID,
        content_type: "background",
        name: row().name,
        data,
        effects,
        source: "homebrew",
        scope: "personal",
        owner_id: USER_ID,
      }),
    );
    expect(db.calls[1].payload).not.toHaveProperty("version");
    expect((db.calls[1].payload as { slug: string }).slug).toMatch(
      /^lantern-guide-[0-9a-f]{8}$/,
    );
  });

  it("returns mapper field validation without querying content tables", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);
    mocks.mapForm.mockReturnValue({
      success: false,
      fieldErrors: { name: ["Name is required."] },
    });

    await expect(createHomebrewBackgroundRecord(form())).resolves.toMatchObject({
      status: "error",
      fieldErrors: { name: ["Name is required."] },
    });
    expect(db.calls).toHaveLength(0);
  });

  it("rejects malformed derived effects before writing", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);
    mocks.mapForm.mockReturnValue({
      success: true,
      data: {
        name: row().name,
        data,
        effects: [{ type: "grant", stat: "skill_proficiency" }],
      },
    });

    await expect(createHomebrewBackgroundRecord(form())).resolves.toEqual({
      status: "error",
      message: "The background contains unsupported structured data.",
    });
    expect(db.calls).toHaveLength(0);
  });

  it("requires an authenticated owner before mapping or writing", async () => {
    const db = makeClient([], false);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(createHomebrewBackgroundRecord(form())).resolves.toEqual({
      status: "error",
      message: "Sign in before creating a homebrew background.",
    });
    expect(mocks.mapForm).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(0);
  });
});

describe("updateHomebrewBackgroundRecord", () => {
  it("uses optimistic versioning and every immutable ownership filter", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: row(4), error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(
      updateHomebrewBackgroundRecord(BACKGROUND_ID, 3, form()),
    ).resolves.toEqual(row(4));
    expect(db.calls[1].operation).toBe("update");
    expect(db.calls[1].payload).toEqual({ name: row().name, data, effects });
    expectFilters(db.calls[1], [
      ["id", BACKGROUND_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "background"],
      ["is_retired", false],
      ["version", 3],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
  });

  it("distinguishes a stale version from a missing or unauthorized background", async () => {
    const stale = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
      { data: { id: BACKGROUND_ID, version: 4 }, error: null },
    ]);
    mocks.createClient.mockResolvedValue(stale.client);
    await expect(
      updateHomebrewBackgroundRecord(BACKGROUND_ID, 3, form()),
    ).resolves.toEqual({
      status: "conflict",
      message:
        "This background changed in another session. Reload it before saving again.",
    });

    const missing = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(missing.client);
    await expect(
      updateHomebrewBackgroundRecord(BACKGROUND_ID, 3, form()),
    ).resolves.toEqual({
      status: "error",
      message: "This homebrew background could not be found.",
    });
  });

  it("rejects malformed identity only after authenticating", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(
      updateHomebrewBackgroundRecord("bad", 0, form()),
    ).resolves.toEqual({
      status: "error",
      message: "The background identifier or version is invalid.",
    });
    expect(db.calls).toHaveLength(0);
  });
});
