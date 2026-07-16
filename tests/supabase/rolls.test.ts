import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RollResult } from "@/lib/dice/types";

const fromMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: (table: string) => fromMock(table) }),
}));

function makeChain() {
  return {
    select: selectMock,
    insert: insertMock,
    eq: eqMock,
    order: orderMock,
    limit: limitMock,
  };
}

const mockResult: RollResult = {
  request: {
    kind: "check",
    label: "Athletics Check",
    expression: "1d20+5",
  },
  groups: [{ sides: 20, rolls: [14], kept: [14] }],
  modifier: 5,
  total: 19,
  natural: 14,
  rolled_at: "2026-07-16T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  const chain = makeChain();
  selectMock.mockReturnValue(chain);
  insertMock.mockResolvedValue({ error: null });
  eqMock.mockReturnValue(chain);
  orderMock.mockReturnValue(chain);
  limitMock.mockResolvedValue({ data: [], error: null });
  fromMock.mockReturnValue(chain);
});

describe("insertRoll", () => {
  it("inserts the denormalized roll row into character_rolls", async () => {
    const { insertRoll } = await import("@/lib/supabase/rolls");
    await insertRoll("char-1", mockResult);
    expect(fromMock).toHaveBeenCalledWith("character_rolls");
    expect(insertMock).toHaveBeenCalledWith({
      character_id: "char-1",
      kind: "check",
      label: "Athletics Check",
      expression: "1d20+5",
      result: mockResult,
      total: 19,
      rolled_at: "2026-07-16T10:00:00.000Z",
    });
  });

  it("logs and does not throw on insert error", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "RLS denied" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { insertRoll } = await import("@/lib/supabase/rolls");
    await expect(insertRoll("char-1", mockResult)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      "[insertRoll] Error:",
      "RLS denied",
    );
    errorSpy.mockRestore();
  });
});

describe("getRecentRolls", () => {
  it("queries newest-first with the default limit of 50", async () => {
    const { getRecentRolls } = await import("@/lib/supabase/rolls");
    await getRecentRolls("char-1");
    expect(fromMock).toHaveBeenCalledWith("character_rolls");
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(eqMock).toHaveBeenCalledWith("character_id", "char-1");
    expect(orderMock).toHaveBeenCalledWith("rolled_at", { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it("passes a custom limit through", async () => {
    const { getRecentRolls } = await import("@/lib/supabase/rolls");
    await getRecentRolls("char-1", 10);
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it("returns rows on success", async () => {
    const row = {
      id: "roll-1",
      character_id: "char-1",
      user_id: "user-1",
      kind: "check",
      label: "Athletics Check",
      expression: "1d20+5",
      result: mockResult,
      total: 19,
      rolled_at: "2026-07-16T10:00:00.000Z",
    };
    limitMock.mockResolvedValueOnce({ data: [row], error: null });
    const { getRecentRolls } = await import("@/lib/supabase/rolls");
    const rolls = await getRecentRolls("char-1");
    expect(rolls).toEqual([row]);
  });

  it("logs and returns [] on fetch error", async () => {
    limitMock.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getRecentRolls } = await import("@/lib/supabase/rolls");
    const rolls = await getRecentRolls("char-1");
    expect(rolls).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith("[getRecentRolls] Error:", "boom");
    errorSpy.mockRestore();
  });
});
