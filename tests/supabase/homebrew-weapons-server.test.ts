import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  mapForm: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homebrew/weapon-form", () => ({
  mapHomebrewWeaponFormData: mocks.mapForm,
}));

import {
  createHomebrewWeaponRecord,
  getOwnedHomebrewWeapon,
  listOwnedHomebrewWeapons,
  updateHomebrewWeaponRecord,
} from "@/lib/supabase/homebrew-weapons-server";
import { weaponDataSchema } from "@/lib/schemas/content-types/weapon";

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
  weapon_category: "Martial" as const,
  weapon_range: "Melee" as const,
  cost: { quantity: 15, unit: "gp" },
  weight: 2.5,
  damage: { dice: "1d8", type: "slashing" as const },
  range: null,
  properties: ["versatile"],
  two_handed_damage: { dice: "1d10", type: "slashing" as const },
};
const data = weaponDataSchema.parse(core);

function row(version = 1) {
  return {
    id: ITEM_ID,
    system_id: SYSTEM_ID,
    content_type: "weapon" as const,
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

describe("createHomebrewWeaponRecord", () => {
  it("derives the immutable private weapon envelope and ignores forged fields", async () => {
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

    await expect(createHomebrewWeaponRecord(input)).resolves.toEqual(row());
    expect(mocks.mapForm).toHaveBeenCalledWith(input);
    expect(db.calls[1].payload).toEqual(expect.objectContaining({
      system_id: SYSTEM_ID,
      content_type: "weapon",
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

    await expect(createHomebrewWeaponRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "Sign in before creating a homebrew weapon.",
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

    await expect(createHomebrewWeaponRecord(new FormData())).resolves.toEqual({
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

    await expect(createHomebrewWeaponRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "The weapon could not be saved. Please try again.",
    });
  });
});

describe("owned homebrew weapon reads", () => {
  it("lists only the current owner's active private weapons", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [row()], error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewWeapons()).resolves.toEqual([row()]);
    expectFilters(db.calls[1], [
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "weapon"],
      ["scope", "personal"],
      ["is_retired", false],
    ]);
    expect(db.calls[1].orders).toEqual(["name"]);
  });

  it("rejects invalid UUIDs before any table lookup", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewWeapon("not-a-uuid")).resolves.toBeNull();
    expect(db.calls).toEqual([]);
  });

  it("constrains a load by owner, type, source, scope, system, and retirement", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewWeapon(ITEM_ID)).resolves.toBeNull();
    expectFilters(db.calls[1], [
      ["id", ITEM_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "weapon"],
      ["scope", "personal"],
      ["is_retired", false],
    ]);
  });
});

describe("updateHomebrewWeaponRecord", () => {
  const identityFilters: Array<[string, unknown]> = [["id", ITEM_ID], ["owner_id", USER_ID], ["system_id", SYSTEM_ID],
    ["source", "homebrew"], ["content_type", "weapon"], ["scope", "personal"], ["is_retired", false]];

  it("preserves all existing extensions and effects during an expected-version core edit", async () => {
    const extendedData = weaponDataSchema.parse({ ...data, ability: 2, monkweapon: true, ammo: "arrow",
      baseWeapon: "longsword", source_refs: [{ book: "Private Tome", page: 12 }], properties: ["versatile", "imported-special-tag"] });
    const effects = [{ type: "mechanical", stat: "speed.walk", op: "add", value: 5 }];
    const current = { ...row(), data: extendedData, effects };
    const saved = { ...current, version: 2 };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: current, error: null }, { data: saved, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    const input = new FormData();
    input.set("effects", "[]"); input.set("ability", "6"); input.set("source_refs", "[]");

    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, input)).resolves.toEqual(saved);
    expect(db.calls[2].payload).toEqual({ name: row().name, data: extendedData });
    expect(db.calls[2].payload).not.toHaveProperty("effects");
    expectFilters(db.calls[1], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[2], [...identityFilters, ["version", 1]]);
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
  });

  it("replaces controlled core fields while retaining extended data", async () => {
    const existingData = weaponDataSchema.parse({ ...data, ability: 1, monkweapon: true });
    const changedCore = { ...core, weight: 0, damage: { dice: "2d6", type: "fire" }, properties: ["heavy"] };
    mocks.mapForm.mockReturnValue({ success: true, data: { name: "New name", data: changedCore } });
    const merged = { ...existingData, ...changedCore };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: { ...row(), data: existingData }, error: null },
      { data: { ...row(2), name: "New name", data: merged }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ version: 2 });
    expect(db.calls[2].payload).toEqual({ name: "New name", data: merged });
  });

  it("rejects signed-out and malformed identities before a table read", async () => {
    const signedOut = makeClient([], false); mocks.createClient.mockResolvedValue(signedOut.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(signedOut.calls).toEqual([]);
    const db = makeClient([]); mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewWeaponRecord("bad", 0, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toEqual([]);
  });

  it("classifies another owner's, inactive, or non-weapon identity without a mutation or disclosure", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: null }, { data: null, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "error", message: "This homebrew weapon could not be found." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
    expectFilters(db.calls[1], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[2], identityFilters);
  });

  it("rejects an already stale draft before mutation", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: null }, { data: { id: ITEM_ID, version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "conflict" });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
  });

  it("detects a concurrent change after the preservation read with one CAS write and constrained reread", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(), error: null },
      { data: null, error: null }, { data: { id: ITEM_ID, version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "conflict",
      message: "This weapon changed in another session. Reload it before saving again." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
    expectFilters(db.calls[2], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[3], identityFilters);
    expect(db.calls[3].selects).toEqual(["id, version"]);
  });

  it("hides preservation-read and conflict-read failures without retry", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: { message: "sensitive" } }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "error", message: "The weapon could not be saved. Please try again." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
    const race = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(), error: null },
      { data: null, error: null }, { data: null, error: { message: "sensitive" } }]);
    mocks.createClient.mockResolvedValue(race.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(race.calls.filter((call) => call.operation === "update")).toHaveLength(1);
  });

  it("does not overwrite a malformed existing extension payload", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: { ...row(), data: { ...data, ability: 99 } }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewWeaponRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
  });
});

describe("weapon persistence runtime validation", () => {
  it("requires a single published system before writing", async () => {
    const db = makeClient([{ data: null, error: { code: "PGRST116" } }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewWeaponRecord(new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toHaveLength(1);
  });

  it("rejects malformed returned cost data instead of claiming a saved weapon", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: { ...row(), data: { ...data, cost: { quantity: -1, unit: "gp" } } }, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewWeaponRecord(new FormData())).resolves.toMatchObject({ status: "error" });
  });
});
