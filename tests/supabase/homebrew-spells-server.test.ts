import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  createHomebrewSpellRecord,
  getOwnedHomebrewSpell,
  getHomebrewSpellCampaignAccess,
  listHomebrewSpellClassOptions,
  listOwnedHomebrewSpells,
  setHomebrewSpellCampaignShare,
  updateHomebrewSpellRecord,
} from "@/lib/supabase/homebrew-spells-server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const SPELL_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_SPELL_ID = "66666666-6666-4666-8666-666666666666";

interface DatabaseResponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface QueryCall {
  table: string;
  operation: "select" | "insert" | "update";
  payload?: unknown;
  selection?: string;
  filters: Array<[string, unknown]>;
  inFilters: Array<[string, unknown[]]>;
  order?: string;
}

function makeClient(
  responses: DatabaseResponse[],
  authenticated = true,
  rpcResponse: DatabaseResponse = { data: null, error: null },
): { client: unknown; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  let responseIndex = 0;

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(authenticated
        ? { data: { user: { id: USER_ID } }, error: null }
        : { data: { user: null }, error: { message: "missing session" } }),
    },
    from: vi.fn((table: string) => {
      const response = responses[responseIndex++] ?? { data: null, error: null };
      const call: QueryCall = {
        table,
        operation: "select",
        filters: [],
        inFilters: [],
      };
      calls.push(call);

      const builder = {
        select(selection: string) {
          call.selection = selection;
          return builder;
        },
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

function form(overrides: Record<string, string | string[]> = {}): FormData {
  const values: Record<string, string | string[]> = {
    system_id: SYSTEM_ID,
    name: "Arcane Burst",
    level: "2",
    school: "evocation",
    casting_time: "1 action",
    range: "60 feet",
    components: ["V", "S"],
    duration: "Instantaneous",
    description: "A focused burst of arcane power.",
    damage_type: "force",
    damage_dice: "2d6",
    save_success: "none",
    classes: ["wizard"],
    ...overrides,
  };
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== "") result.append(key, entry);
    }
  }
  return result;
}

const spellData = {
  level: 2,
  school: "evocation",
  casting_time: "1 action",
  range: "60 feet",
  components: ["V", "S"],
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  description: "A focused burst of arcane power.",
  attack_type: null,
  damage: { type: "force", dice_at_slot_level: { "2": "2d6" } },
  heal_at_slot_level: null,
  dc: null,
  area_of_effect: null,
  classes: ["wizard"],
  subclasses: [],
  dependencies: [],
};

function row(
  version = 1,
  scope: "personal" | "shared" = "personal",
  id = SPELL_ID,
) {
  return {
    id,
    system_id: SYSTEM_ID,
    content_type: "spell",
    slug: "arcane-burst-a1b2c3d4",
    name: "Arcane Burst",
    data: spellData,
    effects: [],
    source: "homebrew",
    scope,
    owner_id: USER_ID,
    version,
    created_at: "2026-07-20T00:00:00.000Z",
    is_retired: false,
  };
}

function expectFilters(call: QueryCall, expected: Array<[string, unknown]>) {
  for (const filter of expected) expect(call.filters).toContainEqual(filter);
}

function expectInFilter(call: QueryCall, column: string, values: unknown[]) {
  expect(call.inFilters).toContainEqual([column, values]);
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe("listHomebrewSpellClassOptions", () => {
  it("loads platform SRD classes from the published 2014 system", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "wizard", name: "Wizard" }], error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(listHomebrewSpellClassOptions()).resolves.toEqual([
      { slug: "wizard", name: "Wizard" },
    ]);

    expectFilters(db.calls[0], [
      ["slug", "dnd-5e-2014"],
      ["status", "published"],
    ]);
    expectFilters(db.calls[1], [
      ["system_id", SYSTEM_ID],
      ["content_type", "class"],
      ["source", "srd"],
      ["scope", "platform"],
      ["is_retired", false],
    ]);
    expect(db.calls[1].order).toBe("name");
  });

  it("requires an authenticated session", async () => {
    const db = makeClient([], false);
    createClientMock.mockResolvedValue(db.client);
    await expect(listHomebrewSpellClassOptions()).rejects.toThrow("Authentication required");
    expect(db.calls).toHaveLength(0);
  });
});

describe("createHomebrewSpellRecord", () => {
  it("derives the entire storage envelope server-side", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "wizard", name: "Wizard" }], error: null },
      { data: row(), error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);
    const input = form();
    input.set("slug", "client-controlled");
    input.set("source", "srd");
    input.set("scope", "platform");
    input.set("owner_id", "attacker");
    input.set("effects", '[{"type":"attack"}]');
    input.set("data", '{"arbitrary":true}');
    input.set("version", "99");

    await expect(createHomebrewSpellRecord(input)).resolves.toEqual(row());

    const insert = db.calls[2];
    expect(insert.operation).toBe("insert");
    expect(insert.payload).toEqual(expect.objectContaining({
      system_id: SYSTEM_ID,
      content_type: "spell",
      name: "Arcane Burst",
      effects: [],
      source: "homebrew",
      scope: "personal",
      owner_id: USER_ID,
      data: expect.objectContaining({ level: 2, classes: ["wizard"] }),
    }));
    expect(insert.payload).toEqual(expect.not.objectContaining({ version: expect.anything() }));
    expect((insert.payload as { slug: string }).slug).toMatch(
      /^arcane-burst-[0-9a-f]{8}$/,
    );
  });

  it("rejects class slugs that were not loaded from the server", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "cleric", name: "Cleric" }], error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(createHomebrewSpellRecord(form())).resolves.toEqual({
      status: "error",
      message: "One or more selected classes are invalid.",
      fieldErrors: { classes: ["Unknown class: wizard"] },
    });
    expect(db.calls).toHaveLength(2);
  });

  it("does not trust a mismatched submitted system id", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }]);
    createClientMock.mockResolvedValue(db.client);

    const result = await createHomebrewSpellRecord(form({
      system_id: "44444444-4444-4444-8444-444444444444",
    }));
    expect(result).toEqual(expect.objectContaining({
      status: "error",
      fieldErrors: { system_id: expect.any(Array) },
    }));
    expect(db.calls).toHaveLength(1);
  });

  it("returns structured validation and authentication failures", async () => {
    const authenticated = makeClient([]);
    createClientMock.mockResolvedValue(authenticated.client);
    await expect(createHomebrewSpellRecord(form({ name: "" }))).resolves.toEqual(
      expect.objectContaining({
        status: "error",
        fieldErrors: expect.objectContaining({ name: expect.any(Array) }),
      }),
    );

    const signedOut = makeClient([], false);
    createClientMock.mockResolvedValue(signedOut.client);
    await expect(createHomebrewSpellRecord(form())).resolves.toEqual({
      status: "error",
      message: "Sign in before creating a homebrew spell.",
    });
  });

  it("turns slug uniqueness failures into a name field error", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "wizard", name: "Wizard" }], error: null },
      { data: null, error: { code: "23505" } },
    ]);
    createClientMock.mockResolvedValue(db.client);
    await expect(createHomebrewSpellRecord(form())).resolves.toEqual({
      status: "error",
      message: "You already have a spell with this name.",
      fieldErrors: { name: ["Choose a unique spell name."] },
    });
  });
});

describe("owner-scoped reads", () => {
  it("lists active personal and shared spells with campaign counts", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [row(3, "shared"), row(2, "shared", SECOND_SPELL_ID)], error: null },
      {
        data: [
          {
            content_id: SPELL_ID,
            campaign_id: "44444444-4444-4444-8444-444444444444",
          },
          {
            content_id: SPELL_ID,
            campaign_id: "55555555-5555-4555-8555-555555555555",
          },
          {
            content_id: SECOND_SPELL_ID,
            campaign_id: "77777777-7777-4777-8777-777777777777",
          },
        ],
        error: null,
      },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewSpells()).resolves.toEqual([
      { ...row(3, "shared"), sharedCampaignCount: 2 },
      { ...row(2, "shared", SECOND_SPELL_ID), sharedCampaignCount: 1 },
    ]);
    expectFilters(db.calls[1], [
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "spell"],
      ["is_retired", false],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
    expectInFilter(db.calls[2], "content_id", [SPELL_ID, SECOND_SPELL_ID]);
    expect(db.calls.filter((call) => call.table === "content_shares")).toHaveLength(1);
    expect((db.client as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it("gets one spell with the same complete ownership boundary", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: row(), error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewSpell(SPELL_ID)).resolves.toEqual(row());
    expectFilters(db.calls[1], [
      ["id", SPELL_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "spell"],
      ["is_retired", false],
    ]);
    expectInFilter(db.calls[1], "scope", ["personal", "shared"]);
  });

  it("returns null for a malformed id only after verifying the session", async () => {
    const db = makeClient([]);
    createClientMock.mockResolvedValue(db.client);
    await expect(getOwnedHomebrewSpell("not-a-uuid")).resolves.toBeNull();
    expect(createClientMock).toHaveBeenCalledOnce();
    expect(db.calls).toHaveLength(0);
  });
});

describe("getHomebrewSpellCampaignAccess", () => {
  it("loads the RPC's same-system membership and current-share union", async () => {
    const CAMPAIGN_A = "44444444-4444-4444-8444-444444444444";
    const CAMPAIGN_B = "55555555-5555-4555-8555-555555555555";
    const db = makeClient([], true, {
      data: [
        { id: CAMPAIGN_A, name: "Tuesday Group", shared: true, eligible: true },
        { id: CAMPAIGN_B, name: "Weekend Game", shared: false, eligible: true },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue(db.client);

    await expect(getHomebrewSpellCampaignAccess(SPELL_ID)).resolves.toEqual({
      campaigns: [
        { id: CAMPAIGN_A, name: "Tuesday Group", shared: true, eligible: true },
        { id: CAMPAIGN_B, name: "Weekend Game", shared: false, eligible: true },
      ],
      sharedCampaignCount: 1,
    });
    expect(db.calls).toHaveLength(0);
    expect((db.client as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "list_owned_content_campaign_access",
      { target_content_id: SPELL_ID },
    );
  });

  it("keeps a current share manageable after the author leaves its campaign", async () => {
    const FORMER_CAMPAIGN = "44444444-4444-4444-8444-444444444444";
    const db = makeClient([], true, {
      data: [{ id: FORMER_CAMPAIGN, name: "Former Group", shared: true, eligible: false }],
      error: null,
    });
    createClientMock.mockResolvedValue(db.client);

    await expect(getHomebrewSpellCampaignAccess(SPELL_ID)).resolves.toEqual({
      campaigns: [{
        id: FORMER_CAMPAIGN,
        name: "Former Group",
        shared: true,
        eligible: false,
      }],
      sharedCampaignCount: 1,
    });
  });

  it("does not load campaign data for content the caller does not own", async () => {
    const db = makeClient([], true, {
      data: null,
      error: { code: "42501", message: "Active owned homebrew content was not found" },
    });
    createClientMock.mockResolvedValue(db.client);
    await expect(getHomebrewSpellCampaignAccess(SPELL_ID)).resolves.toBeNull();
    expect(db.calls).toHaveLength(0);
  });
});

describe("setHomebrewSpellCampaignShare", () => {
  const CAMPAIGN_ID = "44444444-4444-4444-8444-444444444444";

  it("passes validated optimistic inputs to the atomic RPC and parses its row", async () => {
    const db = makeClient([], true, {
      data: [{
        content_id: SPELL_ID,
        version: 2,
        scope: "shared",
        shared_campaign_count: 1,
      }],
      error: null,
    });
    createClientMock.mockResolvedValue(db.client);

    await expect(setHomebrewSpellCampaignShare(SPELL_ID, CAMPAIGN_ID, true, 1))
      .resolves.toEqual({
        contentId: SPELL_ID,
        version: 2,
        scope: "shared",
        sharedCampaignCount: 1,
      });
    expect((db.client as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "set_content_campaign_share",
      {
        target_content_id: SPELL_ID,
        target_campaign_id: CAMPAIGN_ID,
        enabled: true,
        expected_version: 1,
      },
    );
  });

  it("returns a recoverable conflict for a stale expected version", async () => {
    const db = makeClient([], true, {
      data: null,
      error: { code: "40001", message: "stale content version" },
    });
    createClientMock.mockResolvedValue(db.client);
    await expect(setHomebrewSpellCampaignShare(SPELL_ID, CAMPAIGN_ID, false, 2))
      .resolves.toMatchObject({ status: "conflict" });
  });

  it("rejects malformed identifiers and signed-out callers before the RPC", async () => {
    const malformed = makeClient([]);
    createClientMock.mockResolvedValue(malformed.client);
    await expect(setHomebrewSpellCampaignShare("bad", CAMPAIGN_ID, true, 1))
      .resolves.toMatchObject({ status: "error" });
    expect((malformed.client as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();

    const signedOut = makeClient([], false);
    createClientMock.mockResolvedValue(signedOut.client);
    await expect(setHomebrewSpellCampaignShare(SPELL_ID, CAMPAIGN_ID, true, 1))
      .resolves.toEqual({ status: "error", message: "Sign in before changing campaign access." });
  });
});

describe("updateHomebrewSpellRecord", () => {
  it("uses optimistic versioning and every immutable identity filter", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "wizard", name: "Wizard" }], error: null },
      { data: row(4), error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(updateHomebrewSpellRecord(SPELL_ID, 3, form())).resolves.toEqual(row(4));

    const update = db.calls[2];
    expect(update.operation).toBe("update");
    expect(update.payload).toEqual({
      name: "Arcane Burst",
      data: expect.objectContaining({ level: 2, classes: ["wizard"] }),
      effects: [],
    });
    expectFilters(update, [
      ["id", SPELL_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "spell"],
      ["is_retired", false],
      ["version", 3],
    ]);
    expectInFilter(update, "scope", ["personal", "shared"]);
  });

  it("returns a structured conflict when the expected version is stale", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "wizard", name: "Wizard" }], error: null },
      { data: null, error: null },
      { data: { id: SPELL_ID, version: 4 }, error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(updateHomebrewSpellRecord(SPELL_ID, 3, form())).resolves.toEqual({
      status: "conflict",
      message: "This spell changed in another session. Reload it before saving again.",
    });
    expectFilters(db.calls[3], [
      ["id", SPELL_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "spell"],
      ["is_retired", false],
    ]);
    expectInFilter(db.calls[3], "scope", ["personal", "shared"]);
  });

  it("preserves shared scope while saving a new rules version", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "wizard", name: "Wizard" }], error: null },
      { data: row(5, "shared"), error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(updateHomebrewSpellRecord(SPELL_ID, 4, form()))
      .resolves.toEqual(row(5, "shared"));
    expect(db.calls[2].payload).not.toHaveProperty("scope");
    expectInFilter(db.calls[2], "scope", ["personal", "shared"]);
  });

  it("does not report missing or unauthorized content as a conflict", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [{ slug: "wizard", name: "Wizard" }], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    createClientMock.mockResolvedValue(db.client);

    await expect(updateHomebrewSpellRecord(SPELL_ID, 1, form())).resolves.toEqual({
      status: "error",
      message: "This homebrew spell could not be found.",
    });
  });

  it("rejects invalid identifiers after verifying the session", async () => {
    const db = makeClient([]);
    createClientMock.mockResolvedValue(db.client);
    await expect(updateHomebrewSpellRecord("bad", 0, form())).resolves.toEqual({
      status: "error",
      message: "The spell identifier or version is invalid.",
    });
    expect(createClientMock).toHaveBeenCalledOnce();
    expect(db.calls).toHaveLength(0);
  });
});
