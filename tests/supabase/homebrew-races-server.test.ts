import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  mapForm: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/homebrew/race-form", () => ({
  mapHomebrewRaceFormData: mocks.mapForm,
}));

import {
  createHomebrewRaceRecord,
  getOwnedHomebrewRace,
  listOwnedHomebrewRaces,
  updateHomebrewRaceRecord,
} from "@/lib/supabase/homebrew-races-server";
import { raceDataSchema } from "@/lib/schemas/content-types/race";
import { raceCoreAnnotation, raceWalkingEffect, RACE_CORE_ANNOTATION_KEY } from "@/lib/homebrew/race-authoring";

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

const metadata = { size: "Medium" as const, age_description: "Original age notes.", alignment_description: "Original alignment notes.",
  size_description: "Original size notes.", language_description: "Original language notes." };
const data = raceDataSchema.parse({ ...metadata, speed: 40, speed_detail: { walk: 40 } });
const rawData = { ...data, [RACE_CORE_ANNOTATION_KEY]: raceCoreAnnotation(40) };
const ownedEffects = [raceWalkingEffect(40)];

function row(version = 1) {
  return {
    id: ITEM_ID,
    system_id: SYSTEM_ID,
    content_type: "race" as const,
    slug: "oathbound-compass-a1b2c3d4",
    name: "Oathbound Compass",
    data: rawData,
    effects: ownedEffects,
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
    data: { name: row().name, metadata, walkingSpeed: 40 },
  });
});

describe("createHomebrewRaceRecord", () => {
  it("derives the immutable private race envelope and ignores forged fields", async () => {
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

    await expect(createHomebrewRaceRecord(input)).resolves.toEqual({ ...row(), data, walkingEditable: true });
    expect(mocks.mapForm).toHaveBeenCalledWith(input, true);
    expect(db.calls[1].payload).toEqual(expect.objectContaining({
      system_id: SYSTEM_ID,
      content_type: "race",
      name: row().name,
      data: rawData,
      effects: ownedEffects,
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

    await expect(createHomebrewRaceRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "Sign in before creating a homebrew race.",
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

    await expect(createHomebrewRaceRecord(new FormData())).resolves.toEqual({
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

    await expect(createHomebrewRaceRecord(new FormData())).resolves.toEqual({
      status: "error",
      message: "The race could not be saved. Please try again.",
    });
  });
});

describe("owned homebrew race reads", () => {
  it("lists only the current owner's active private races", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: [row()], error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(listOwnedHomebrewRaces()).resolves.toEqual([{ ...row(), data, walkingEditable: true }]);
    expectFilters(db.calls[1], [
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "race"],
      ["scope", "personal"],
      ["is_retired", false],
    ]);
    expect(db.calls[1].orders).toEqual(["name"]);
  });

  it("rejects invalid UUIDs before any table lookup", async () => {
    const db = makeClient([]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewRace("not-a-uuid")).resolves.toBeNull();
    expect(db.calls).toEqual([]);
  });

  it("constrains a load by owner, type, source, scope, system, and retirement", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);

    await expect(getOwnedHomebrewRace(ITEM_ID)).resolves.toBeNull();
    expectFilters(db.calls[1], [
      ["id", ITEM_ID],
      ["owner_id", USER_ID],
      ["system_id", SYSTEM_ID],
      ["source", "homebrew"],
      ["content_type", "race"],
      ["scope", "personal"],
      ["is_retired", false],
    ]);
  });
});

describe("updateHomebrewRaceRecord", () => {
  const identityFilters: Array<[string, unknown]> = [["id", ITEM_ID], ["owner_id", USER_ID], ["system_id", SYSTEM_ID],
    ["source", "homebrew"], ["content_type", "race"], ["scope", "personal"], ["is_retired", false]];

  function input(speed = "50") {
    const form = new FormData();
    for (const [key, value] of Object.entries({ name: "Renamed race", ...metadata, speed,
      walkingEditable: "true", effects: "[]", data: '{}', source: "srd", scope: "platform" })) form.set(key, value);
    return form;
  }

  it("replaces exactly one annotated raw effect at its original position and retains all unrelated data/effects", async () => {
    const actual = await vi.importActual<typeof import("@/lib/homebrew/race-form")>("@/lib/homebrew/race-form");
    mocks.mapForm.mockImplementation(actual.mapHomebrewRaceFormData);
    const extended = { ...rawData, description: "Imported lore", custom_metadata: { maker: "Original", nested: [1, 2] },
      traits: ["preserved-trait"], subraces: ["preserved-subrace"], scores: [0, 1, 0, 0, 0, 0],
      speed_detail: { walk: 40, fly: 10, custom_note: "Retain this" } };
    const unrelated = [{ type: "narrative", text: "Original manual narrative", extra: { keep: true } },
      { type: "mechanical", stat: "armor_class", op: "add", value: 1, manual_note: "Keep" }];
    const effects = [unrelated[0], raceWalkingEffect(40), unrelated[1]];
    const merged = { ...extended, speed: 50, speed_detail: { ...extended.speed_detail, walk: 50 }, [RACE_CORE_ANNOTATION_KEY]: raceCoreAnnotation(50) };
    const savedEffects = [unrelated[0], raceWalkingEffect(50), unrelated[1]];
    const current = { ...row(), data: extended, effects };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: current, error: null },
      { data: { ...current, name: "Renamed race", version: 2, data: merged, effects: savedEffects }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    const form = input(); form.set("custom_metadata", "{}"); form.set("traits", "[]"); form.set("scores", "[9,9,9,9,9,9]");
    const result = await updateHomebrewRaceRecord(ITEM_ID, 1, form);
    expect(result).toMatchObject({ version: 2, name: "Renamed race", walkingEditable: true });
    expect(db.calls[2].payload).toEqual({ name: "Renamed race", data: merged, effects: savedEffects });
    expect(result).not.toHaveProperty("data.custom_metadata");
    expect(result).not.toHaveProperty(`data.${RACE_CORE_ANNOTATION_KEY}`);
    expectFilters(db.calls[1], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[2], [...identityFilters, ["version", 1]]);
  });

  it.each(["legacy", "extra-field", "duplicate", "competing", "mismatch", "altered-manifest"])("keeps %s movement read-only even when browser forges speed/eligibility", async (kind) => {
    const actual = await vi.importActual<typeof import("@/lib/homebrew/race-form")>("@/lib/homebrew/race-form");
    mocks.mapForm.mockImplementation(actual.mapHomebrewRaceFormData);
    let effects: unknown[] = [...ownedEffects];
    const existing: Record<string, unknown> = { ...rawData, custom_metadata: { retain: true } };
    if (kind === "legacy") { delete existing[RACE_CORE_ANNOTATION_KEY]; effects = [{ type: "mechanical", stat: "movement_speed", op: "set", value: 40 }]; }
    if (kind === "extra-field") effects = [{ ...raceWalkingEffect(40), condition: { field: "x", op: "eq", value: true } }];
    if (kind === "duplicate") effects.push(raceWalkingEffect(40));
    if (kind === "competing") effects.push({ type: "mechanical", stat: "movement_speed", op: "add", value: 5 });
    if (kind === "mismatch") existing.speed_detail = { walk: 35, extra: "preserve" };
    if (kind === "altered-manifest") existing[RACE_CORE_ANNOTATION_KEY] = { ...raceCoreAnnotation(40), extra: true };
    const current = { ...row(), data: existing, effects };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: current, error: null }, { data: { ...current, version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    const result = await updateHomebrewRaceRecord(ITEM_ID, 1, input("bogus forged speed"));
    expect(result).toMatchObject({ version: 2, walkingEditable: false });
    expect(db.calls[2].payload).toEqual({ name: "Renamed race", data: existing });
    expect(db.calls[2].payload).not.toHaveProperty("effects");
    expect(mocks.mapForm).toHaveBeenCalledWith(expect.any(FormData), false);
  });

  it("accepts valid owner-edited annotation as a convention but derives eligibility from the row, never browser flags", async () => {
    const actual = await vi.importActual<typeof import("@/lib/homebrew/race-form")>("@/lib/homebrew/race-form");
    mocks.mapForm.mockImplementation(actual.mapHomebrewRaceFormData);
    const current = { ...row(), data: { ...rawData, speed: 45, speed_detail: { walk: 45 }, [RACE_CORE_ANNOTATION_KEY]: raceCoreAnnotation(45) }, effects: [raceWalkingEffect(45)] };
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: current, error: null }, { data: row(2), error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    const form = input("50"); form.set("walkingEditable", "false");
    await updateHomebrewRaceRecord(ITEM_ID, 1, form);
    expect(db.calls[2].payload).toMatchObject({ data: { speed: 50 }, effects: [raceWalkingEffect(50)] });
    expect(mocks.mapForm).toHaveBeenCalledWith(form, true);
  });

  it("rejects signed-out and malformed identities before a table read", async () => {
    const signedOut = makeClient([], false); mocks.createClient.mockResolvedValue(signedOut.client);
    await expect(updateHomebrewRaceRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(signedOut.calls).toEqual([]);
    const db = makeClient([]); mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewRaceRecord("bad", 0, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toEqual([]);
  });

  it("classifies another owner's, inactive, or non-race identity without a mutation or disclosure", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: null }, { data: null, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewRaceRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "error", message: "This homebrew race could not be found." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
    expectFilters(db.calls[1], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[2], identityFilters);
  });

  it("rejects an already stale draft before mutation", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: null }, { data: { id: ITEM_ID, version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewRaceRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "conflict" });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
  });

  it("detects a concurrent change after the preservation read with one CAS write and constrained reread", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(), error: null },
      { data: null, error: null }, { data: { id: ITEM_ID, version: 2 }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewRaceRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "conflict",
      message: "This race changed in another session. Reload it before saving again." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(1);
    expectFilters(db.calls[2], [...identityFilters, ["version", 1]]);
    expectFilters(db.calls[3], identityFilters);
    expect(db.calls[3].selects).toEqual(["id, version"]);
  });

  it("hides preservation-read and conflict-read failures without retry", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: null, error: { message: "sensitive" } }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewRaceRecord(ITEM_ID, 1, new FormData())).resolves.toEqual({ status: "error", message: "The race could not be saved. Please try again." });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
    const race = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: row(), error: null },
      { data: null, error: null }, { data: null, error: { message: "sensitive" } }]);
    mocks.createClient.mockResolvedValue(race.client);
    await expect(updateHomebrewRaceRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(race.calls.filter((call) => call.operation === "update")).toHaveLength(1);
  });

  it("does not overwrite a malformed existing extension payload", async () => {
    const db = makeClient([{ data: { id: SYSTEM_ID }, error: null }, { data: { ...row(), data: { ...rawData, speed: "invalid" } }, error: null }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(updateHomebrewRaceRecord(ITEM_ID, 1, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
  });
});

describe("race persistence runtime validation", () => {
  it("requires a single published system before writing", async () => {
    const db = makeClient([{ data: null, error: { code: "PGRST116" } }]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewRaceRecord(new FormData())).resolves.toMatchObject({ status: "error" });
    expect(db.calls).toHaveLength(1);
  });

  it("rejects malformed returned speed data instead of claiming a saved race", async () => {
    const db = makeClient([
      { data: { id: SYSTEM_ID }, error: null },
      { data: { ...row(), data: { ...rawData, speed: -1 } }, error: null },
    ]);
    mocks.createClient.mockResolvedValue(db.client);
    await expect(createHomebrewRaceRecord(new FormData())).resolves.toMatchObject({ status: "error" });
  });
});
