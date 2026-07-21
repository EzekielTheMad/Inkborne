import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { syncClassFeatureRefs } from "@/lib/supabase/feature-refs-server";

const CHARACTER_ID = "77777777-7777-4777-8777-777777777777";

function makeClient(response: {
  data: unknown;
  error: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue(response);
  return { client: { rpc }, rpc };
}

describe("syncClassFeatureRefs", () => {
  it("uses one atomic RPC and never accepts caller-supplied class levels", async () => {
    const db = makeClient({
      data: [{ inserted: 2, deleted: 1 }],
      error: null,
    });

    await expect(
      syncClassFeatureRefs(db.client as never, {
        characterId: CHARACTER_ID,
        classChoices: [{ slug: "forged", level: 20 }],
      }),
    ).resolves.toEqual({ inserted: 2, deleted: 1 });

    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("sync_character_feature_refs", {
      target_character_id: CHARACTER_ID,
    });
  });

  it("surfaces authorization and transaction failures without fallback writes", async () => {
    const db = makeClient({
      data: null,
      error: { message: "Character not found or not owned by caller" },
    });

    await expect(
      syncClassFeatureRefs(db.client as never, { characterId: CHARACTER_ID }),
    ).rejects.toThrow(
      "[syncClassFeatureRefs] atomic feature reconciliation failed: Character not found or not owned by caller",
    );
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    [],
    [{ inserted: -1, deleted: 0 }],
    [{ inserted: 1 }],
    [
      { inserted: 1, deleted: 0 },
      { inserted: 0, deleted: 0 },
    ],
  ])("fails closed for a malformed RPC result: %j", async (data) => {
    const db = makeClient({ data, error: null });

    await expect(
      syncClassFeatureRefs(db.client as never, { characterId: CHARACTER_ID }),
    ).rejects.toThrow("invalid feature-grant reconciliation result");
  });
});
