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

  it("falls back to select+update when RPC fails", async () => {
    rpcMock.mockResolvedValue({ error: { message: "no rpc" } });

    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const selectSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { state: { current_hp: 10, conditions: ["prone"] } },
          error: null,
        }),
      }),
    });

    fromMock.mockReturnValue({
      select: selectSpy,
      update: updateSpy,
    });

    await updateCharacterState("char-456", { current_hp: 20 });

    // fromMock is called for both select and update paths
    expect(fromMock).toHaveBeenCalledWith("characters");
    expect(selectSpy).toHaveBeenCalledWith("state");
    expect(updateSpy).toHaveBeenCalledWith({
      state: { current_hp: 20, conditions: ["prone"] },
    });
  });
});
