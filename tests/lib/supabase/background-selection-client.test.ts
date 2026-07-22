import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: rpcMock }),
}));

import { setCharacterBackground } from "@/lib/supabase/background-selection-client";

describe("setCharacterBackground", () => {
  beforeEach(() => rpcMock.mockReset());

  it("selects an exact background version and parses canonical choices", async () => {
    rpcMock.mockResolvedValue({
      data: [{
        saved_choices: { background: "lantern-courier" },
        selected_content_id: "11111111-1111-4111-8111-111111111111",
        selected_content_version: 3,
      }],
      error: null,
    });

    await expect(setCharacterBackground(
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
      3,
    )).resolves.toEqual({
      savedChoices: { background: "lantern-courier" },
      selectedContentId: "11111111-1111-4111-8111-111111111111",
      selectedContentVersion: 3,
    });

    expect(rpcMock).toHaveBeenCalledWith("set_character_background", {
      target_character_id: "22222222-2222-4222-8222-222222222222",
      target_content_id: "11111111-1111-4111-8111-111111111111",
      target_content_version: 3,
    });
  });

  it("clears a background with paired null identity values", async () => {
    rpcMock.mockResolvedValue({
      data: [{
        saved_choices: { personality_traits: [] },
        selected_content_id: null,
        selected_content_version: null,
      }],
      error: null,
    });

    await expect(setCharacterBackground(
      "22222222-2222-4222-8222-222222222222",
      null,
      null,
    )).resolves.toMatchObject({
      selectedContentId: null,
      selectedContentVersion: null,
    });
  });

  it("rejects database errors and malformed response envelopes", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(setCharacterBackground(
      "22222222-2222-4222-8222-222222222222",
      null,
      null,
    )).rejects.toThrow("denied");

    rpcMock.mockResolvedValueOnce({
      data: [{
        saved_choices: {},
        selected_content_id: "11111111-1111-4111-8111-111111111111",
        selected_content_version: null,
      }],
      error: null,
    });
    await expect(setCharacterBackground(
      "22222222-2222-4222-8222-222222222222",
      null,
      null,
    )).rejects.toThrow(/response was invalid/i);
  });
});
