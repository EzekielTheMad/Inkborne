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

describe("conditional HP persistence", () => {
  it("sends the exact raw snapshot and returns canonical applied state", async () => {
    const raw = { current_hp: 10, quick_notes: "keep" };
    rpcMock.mockResolvedValue({ error: null, data: [{ status: "applied", resulting_state: { ...raw, current_hp: 8 } }] });
    expect(await updateCharacterState("char", { current_hp: 8 }, raw)).toEqual({ ...raw, current_hp: 8 });
    expect(rpcMock).toHaveBeenCalledWith("patch_character_state_if_current", { character_id: "char", expected_state: raw, state_patch: { current_hp: 8 } });
  });
  it.each(["conflict", "missing"])("requires explicit reload on %s, without legacy fallback", async status => {
    rpcMock.mockResolvedValue({ error: null, data: [{ status, resulting_state: status === "missing" ? null : { current_hp: 8 } }] });
    await expect(updateCharacterState("char", { current_hp: 7 }, { current_hp: 10 })).rejects.toMatchObject({ requiresReload: true });
    expect(rpcMock).toHaveBeenCalledTimes(1); expect(fromMock).not.toHaveBeenCalled();
  });
  it.each([{ error: { message: "response lost" }, data: null }, { error: null, data: [] }])("treats unconfirmed results as uncertain with no retry", async response => {
    rpcMock.mockResolvedValue(response);
    await expect(updateCharacterState("char", { current_hp: 8 }, { current_hp: 10 })).rejects.toThrow("could not be confirmed");
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});
