import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  listUsableFeatsForCharacter,
  setCharacterAsiChoiceRecord,
} from "@/lib/supabase/feat-selection-server";

const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";
const FEAT_ID = "22222222-2222-4222-8222-222222222222";

interface RpcResponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

function makeClient(response: RpcResponse, authenticated = true) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(authenticated
        ? { data: { user: { id: "user" } }, error: null }
        : { data: { user: null }, error: { message: "signed out" } }),
    },
    rpc: vi.fn().mockResolvedValue(response),
  };
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe("listUsableFeatsForCharacter", () => {
  it("calls the exact-character RPC and maps the narrow serializable DTO", async () => {
    const client = makeClient({
      data: [{
        id: FEAT_ID,
        name: "Sentinel",
        description: "Guard a nearby ally.",
        version: 3,
        source: "homebrew",
        scope: "shared",
        prerequisite_met: false,
        prerequisite_reason: "STR 13 required (currently 12)",
      }],
      error: null,
    });
    createClientMock.mockResolvedValue(client);

    await expect(listUsableFeatsForCharacter(
      CHARACTER_ID,
      "sent",
      "fighter-asi-4",
    ))
      .resolves.toEqual([{
        id: FEAT_ID,
        name: "Sentinel",
        description: "Guard a nearby ally.",
        version: 3,
        source: "homebrew",
        scope: "shared",
        prerequisiteMet: false,
        prerequisiteReason: "STR 13 required (currently 12)",
      }]);
    expect(client.rpc).toHaveBeenCalledWith("search_usable_feats_for_character", {
      target_character_id: CHARACTER_ID,
      search_query: "sent",
      result_limit: 50,
      target_feature_slug: "fighter-asi-4",
    });
  });

  it("rejects malformed or oversized search input before authentication", async () => {
    const client = makeClient({ data: [], error: null });
    createClientMock.mockResolvedValue(client);
    await expect(listUsableFeatsForCharacter("bad", "x".repeat(201)))
      .rejects.toThrow("invalid");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("requires a server-authenticated session and rejects malformed rows", async () => {
    const signedOut = makeClient({ data: [], error: null }, false);
    createClientMock.mockResolvedValue(signedOut);
    await expect(listUsableFeatsForCharacter(CHARACTER_ID))
      .rejects.toThrow("Authentication required");
    expect(signedOut.rpc).not.toHaveBeenCalled();

    const malformed = makeClient({ data: [{ id: FEAT_ID }], error: null });
    createClientMock.mockResolvedValue(malformed);
    await expect(listUsableFeatsForCharacter(CHARACTER_ID)).rejects.toThrow();
  });

  it("passes a null slot boundary when discovery is not scoped to one ASI", async () => {
    const client = makeClient({ data: [], error: null });
    createClientMock.mockResolvedValue(client);

    await expect(listUsableFeatsForCharacter(CHARACTER_ID)).resolves.toEqual([]);
    expect(client.rpc).toHaveBeenCalledWith("search_usable_feats_for_character", {
      target_character_id: CHARACTER_ID,
      search_query: "",
      result_limit: 50,
      target_feature_slug: null,
    });
  });
});

describe("setCharacterAsiChoiceRecord", () => {
  it("sends only normalized ASI inputs and returns authoritative database state", async () => {
    const choice = {
      mode: "asi" as const,
      allocations: [
        { ability: "strength", amount: 1 },
        { ability: "dexterity", amount: 1 },
      ],
    };
    const choices = { asi_choices: { "fighter-asi-4": choice }, classes: [] };
    const client = makeClient({
      data: [{
        saved_feature_slug: "fighter-asi-4",
        saved_choice: choice,
        saved_choices: choices,
      }],
      error: null,
    });
    createClientMock.mockResolvedValue(client);

    await expect(setCharacterAsiChoiceRecord({
      characterId: CHARACTER_ID,
      featureSlug: "fighter-asi-4",
      choice,
    })).resolves.toEqual({
      status: "success",
      featureSlug: "fighter-asi-4",
      choice,
      choices,
    });
    expect(client.rpc).toHaveBeenCalledWith("set_character_asi_choice", {
      target_character_id: CHARACTER_ID,
      target_feature_slug: "fighter-asi-4",
      choice_mode: "asi",
      ability_allocations: choice.allocations,
      target_feat_id: null,
      target_feat_version: null,
    });
  });

  it("ignores caller feat names and lets the database return the live snapshot", async () => {
    const clientChoice = {
      mode: "feat" as const,
      featId: FEAT_ID,
      featVersion: 2,
      featName: "Stale browser label",
    };
    const savedChoice = { ...clientChoice, featName: "Server Sentinel" };
    const client = makeClient({
      data: [{
        saved_feature_slug: "fighter-asi-4",
        saved_choice: savedChoice,
        saved_choices: { asi_choices: { "fighter-asi-4": savedChoice } },
      }],
      error: null,
    });
    createClientMock.mockResolvedValue(client);

    await expect(setCharacterAsiChoiceRecord({
      characterId: CHARACTER_ID,
      featureSlug: "fighter-asi-4",
      choice: clientChoice,
    })).resolves.toMatchObject({ status: "success", choice: savedChoice });
    expect(client.rpc).toHaveBeenCalledWith("set_character_asi_choice", {
      target_character_id: CHARACTER_ID,
      target_feature_slug: "fighter-asi-4",
      choice_mode: "feat",
      ability_allocations: null,
      target_feat_id: FEAT_ID,
      target_feat_version: 2,
    });
  });

  it("rejects incomplete local choices without calling Supabase", async () => {
    const client = makeClient({ data: null, error: null });
    createClientMock.mockResolvedValue(client);
    await expect(setCharacterAsiChoiceRecord({
      characterId: CHARACTER_ID,
      featureSlug: "fighter-asi-4",
      choice: {
        mode: "asi",
        allocations: [{ ability: "luck", amount: 2 }],
      },
    })).resolves.toMatchObject({ status: "error", code: "invalid" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("does not call the mutation RPC for a signed-out request", async () => {
    const client = makeClient({ data: null, error: null }, false);
    createClientMock.mockResolvedValue(client);
    await expect(setCharacterAsiChoiceRecord({
      characterId: CHARACTER_ID,
      featureSlug: "fighter-asi-4",
      choice: {
        mode: "feat",
        featId: FEAT_ID,
        featVersion: 2,
        featName: "Sentinel",
      },
    })).resolves.toMatchObject({ status: "error", code: "unauthorized" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["40001", "conflict"],
    ["42501", "unauthorized"],
    ["22023", "invalid"],
    ["P0001", "unavailable"],
  ])("maps database code %s to %s", async (databaseCode, resultCode) => {
    const client = makeClient({
      data: null,
      error: { code: databaseCode, message: "Actionable database message" },
    });
    createClientMock.mockResolvedValue(client);

    await expect(setCharacterAsiChoiceRecord({
      characterId: CHARACTER_ID,
      featureSlug: "fighter-asi-4",
      choice: {
        mode: "feat",
        featId: FEAT_ID,
        featVersion: 2,
        featName: "Sentinel",
      },
    })).resolves.toEqual({
      status: "error",
      code: resultCode,
      message: "Actionable database message",
    });
  });
});
