import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  mapForm: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homebrew/armor-form", () => ({
  mapHomebrewArmorFormData: mocks.mapForm,
}));

import {
  createHomebrewArmorRecord,
  getOwnedHomebrewArmor,
  listOwnedHomebrewArmors,
  updateHomebrewArmorRecord,
} from "@/lib/supabase/homebrew-armors-server";
import { armorDataSchema } from "@/lib/schemas/content-types/armor";

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
  selects: string[];
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
        selects: [],
      };
      calls.push(call);
      const builder = {
        select: vi.fn((columns: string) => { call.selects.push(columns); return builder; }),
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

const core = {
  armor_category: "Medium" as const, cost: { quantity: 15, unit: "gp" }, weight: 20,
  armor_class: { base: 14, dex_bonus: true, max_bonus: 2 }, str_minimum: 0, stealth_disadvantage: true,
};
const data = armorDataSchema.parse(core);

function row(version = 1) {
  return {
    id: ITEM_ID,
    system_id: SYSTEM_ID,
    content_type: "armor" as const,
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
    data: { name: row().name, data: core },
  });
});

describe("createHomebrewArmorRecord", () => {
  it("derives the immutable private armor envelope and ignores forged fields", async () => {
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

    await expect(createHomebrewArmorRecord(input)).resolves.toEqual(row());
    expect(mocks.mapForm).toHaveBeenCalledWith(input);
    expect(db.calls[1].payload).toEqual(expect.objectContaining({
      system_id: SYSTEM_ID,
      content_type: "armor",
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

    await expect(createHomebrewArmorRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "Sign in before creating a homebrew armor.",
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

    await expect(createHomebrewArmorRecord(new FormData())).resolves.toEqual({
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

    await expect(createHomebrewArmorRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "The armor could not be saved. Please try again.",
    });
  });
});

describe("owned homebrew armor reads", () => {
  it("lists only the current owner's active private armors", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [row()], error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewArmors()).resolves.toEqual([row()]);
    expectFilters(db.calls[1], [
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "armor"],
      ["scope", "personal"],
      ["is_retired", false],
    ]);
    expect(db.calls[1].orders).toEqual(["name"]);
  });

  it("rejects invalid UUIDs before any table lookup", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewArmor("not-a-uuid")).resolves.toBeNull();
    expect(db.calls).toEqual([]);
  });

  it("constrains a load by owner, type, source, scope, system, and retirement", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewArmor(ITEM_ID)).resolves.toBeNull();
    expectFilters(db.calls[1], [
      ["id", ITEM_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "armor"],
      ["scope", "personal"],
      ["is_retired", false],
    ]);
  });
});

describe("updateHomebrewArmorRecord", () => {
  const identityFilters: Array<[string, unknown]> = [["id", ITEM_ID], ["owner_id", USER_ID], ["system_id", SYSTEM_ID],
    ["source", "homebrew"], ["content_type", "armor"], ["scope", "personal"], ["is_retired", false]];

  it("overlays only authored fields and preserves original raw nested metadata and effects", async () => {
    const actualMapper = await vi.importActual<typeof import("@/lib/homebrew/armor-form")>("@/lib/homebrew/armor-form");
    mocks.mapForm.mockImplementation(actualMapper.mapHomebrewArmorFormData);
    const rawData = { ...data, description: "Original imported lore.", custom_metadata: { maker: "Original smith", history: [{ year: 42 }] },
      armor_class: { ...core.armor_class, custom_note: "Original AC provenance" }, cost: { ...core.cost, price_note: "Original trade value" } };
    const effects = [{ type: "mechanical", stat: "speed.walk", op: "add", value: 5 }];
    const current = { ...row(), data: rawData, effects };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: current, error: null },
      { data: { ...current, name: "Renamed armor", version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    const input = new FormData();
    for (const [key, value] of Object.entries({ name: "Renamed armor", armor_category: "Medium", cost_quantity: "15", cost_unit: "gp",
      weight: "20", armor_class_base: "14", dex_bonus: "on", max_bonus: "2", str_minimum: "0", stealth_disadvantage: "on",
      description: "Forged lore", custom_metadata: '{"maker":"attacker"}', data: '{}', armor_class: '{}', cost: '{}', effects: "[]" })) input.set(key, value);
    const result = await updateHomebrewArmorRecord(ITEM_ID, 1, input);
    expect(result).toMatchObject({ version: 2, name: "Renamed armor", effects });
    expect(db.calls[2].payload).toEqual({ name: "Renamed armor", data: rawData });
    expect(db.calls[2].payload).not.toHaveProperty("effects");
    expect(result).not.toHaveProperty("data.custom_metadata");
    expectFilters(db.calls[1], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[2], [...identityFilters, ["version", 1]]);
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
  });

  it("applies intentional core replacements including cleared nullable cost", async () => {
    const existingData = { ...data, custom_metadata: { retained: true }, armor_class: { ...core.armor_class, provenance: "retained" } };
    const changedCore = { ...core, armor_category: "Heavy", weight: 0, cost: null, armor_class: { base: 18, dex_bonus: false, max_bonus: null } };
    mocks.mapForm.mockReturnValue({ success: true, data: { name: "New name", data: changedCore } });
    const merged = { ...existingData, ...changedCore, armor_class: { ...existingData.armor_class, ...changedCore.armor_class } };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: { ...row(), data: existingData }, error: null },
      { data: { ...row(2), name: "New name", data: merged }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ version: 2 });
    expect(db.calls[2].payload).toEqual({ name: "New name", data: merged });
  });

  it("rejects signed-out and malformed identities before a table read", async () => {
    const signedOut = makeClient([], false); mocks.createClient.mockResolvedValue(signedOut.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(signedOut.calls).toEqual([]);
    const db = makeClient([]); mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewArmorRecord("bad", 0, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toEqual([]);
  });

  it("classifies another owner's, inactive, or non-armor identity without a mutation or disclosure", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: null }, { data: null, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "error", message: "This homebrew armor could not be found." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
    expectFilters(db.calls[1], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[2], identityFilters);
  });

  it("rejects an already stale draft before mutation", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: null }, { data: { id: ITEM_ID, version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "conflict" });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
  });

  it("detects a concurrent change after the preservation read with one CAS write and constrained reread", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(), error: null },
      { data: null, error: null }, { data: { id: ITEM_ID, version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "conflict",
      message: "This armor changed in another session. Reload it before saving again." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
    expectFilters(db.calls[2], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[3], identityFilters);
    expect(db.calls[3].selects).toEqual(["id, version"]);
  });

  it("hides preservation-read and conflict-read failures without retry", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: { message: "sensitive" } }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "error", message: "The armor could not be saved. Please try again." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
    const race = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(), error: null },
      { data: null, error: null }, { data: null, error: { message: "sensitive" } }]);
    mocks.createClient.mockResolvedValue(race.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(race.calls.filter((call) => call.operation === "update")).toHaveLength(1);
  });

  it("does not overwrite a malformed existing extension payload", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: { ...row(), data: { ...data, armor_class: { base: "invalid" } } }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewArmorRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
  });
});

describe("armor persistence runtime validation", () => {
  it("requires a single published system before writing", async () => {
    const db = makeClient([{ data: null, error: { code: "PGRST116" } }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewArmorRecord(new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toHaveLength(1);
  });

  it("rejects malformed returned cost data instead of claiming a saved armor", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: { ...row(), data: { ...data, cost: { quantity: -1, unit: "gp" } } }, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewArmorRecord(new FormData())).resolves.toMatchObject({ status: "error" });
  });
});
