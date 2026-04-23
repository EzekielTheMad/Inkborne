import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateCharacterState } from "@/lib/sheet/update-state";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: unknown) => rpcMock(name, args),
    from: (table: string) => fromMock(table),
  }),
}));

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("updateCharacterState", () => {
  it("calls patch_character_state RPC with character_id and state_patch", async () => {
    rpcMock.mockResolvedValue({ error: null });
    await updateCharacterState("char-123", { current_hp: 42 });

    expect(rpcMock).toHaveBeenCalledWith("patch_character_state", {
      character_id: "char-123",
      state_patch: { current_hp: 42 },
    });
  });

  it("throws when the RPC returns an error", async () => {
    const rpcError = { message: "permission denied" };
    rpcMock.mockResolvedValue({ error: rpcError });

    await expect(
      updateCharacterState("char-456", { current_hp: 20 }),
    ).rejects.toEqual(rpcError);

    // No fallback select/update path should run — RPC errors propagate.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("resolves without error when RPC succeeds", async () => {
    rpcMock.mockResolvedValue({ error: null });

    await expect(
      updateCharacterState("char-789", { conditions: ["poisoned"] }),
    ).resolves.toBeUndefined();
  });
});
