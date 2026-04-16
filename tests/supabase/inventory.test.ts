import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const orderMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const singleMock = vi.fn();
const ilikeMock = vi.fn();
const limitMock = vi.fn();
const inMock = vi.fn();
const orMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => fromMock(table),
  }),
}));

function makeChain() {
  const chain = {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    order: orderMock,
    eq: eqMock,
    single: singleMock,
    ilike: ilikeMock,
    limit: limitMock,
    in: inMock,
    or: orMock,
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  const chain = makeChain();
  selectMock.mockReturnValue(chain);
  insertMock.mockReturnValue(chain);
  updateMock.mockReturnValue(chain);
  deleteMock.mockReturnValue(chain);
  orderMock.mockReturnValue(chain);
  eqMock.mockReturnValue(chain);
  singleMock.mockResolvedValue({ data: {}, error: null });
  ilikeMock.mockReturnValue(chain);
  limitMock.mockResolvedValue({ data: [], error: null });
  inMock.mockReturnValue(chain);
  orMock.mockReturnValue(chain);
  fromMock.mockReturnValue(chain);
});

describe("getInventoryForCharacter", () => {
  it("selects by character_id with content_definitions join", async () => {
    orderMock.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const { getInventoryForCharacter } = await import("@/lib/supabase/inventory");
    await getInventoryForCharacter("char-1");
    expect(fromMock).toHaveBeenCalledWith("character_inventory");
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("content_definitions"),
    );
    expect(eqMock).toHaveBeenCalledWith("character_id", "char-1");
  });
});

describe("addInventoryItem", () => {
  it("inserts with character_id and defaults quantity to 1", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "inv-1",
        character_id: "char-1",
        content_id: "c1",
        name: "Longsword",
        content_type: "weapon",
        quantity: 1,
      },
      error: null,
    });
    const { addInventoryItem } = await import("@/lib/supabase/inventory");
    const result = await addInventoryItem("char-1", {
      content_id: "c1",
      name: "Longsword",
      content_type: "weapon",
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        character_id: "char-1",
        content_id: "c1",
        name: "Longsword",
        content_type: "weapon",
        quantity: 1,
      }),
    );
    expect(result?.name).toBe("Longsword");
  });
});

describe("updateInventoryItem", () => {
  it("updates the item by id with the patch", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { updateInventoryItem } = await import("@/lib/supabase/inventory");
    await updateInventoryItem("inv-1", { equipped: true });
    expect(updateMock).toHaveBeenCalledWith({ equipped: true });
    expect(eqMock).toHaveBeenCalledWith("id", "inv-1");
  });
});

describe("removeInventoryItem", () => {
  it("deletes the item by id", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { removeInventoryItem } = await import("@/lib/supabase/inventory");
    await removeInventoryItem("inv-1");
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "inv-1");
  });
});

describe("unequipAllArmor", () => {
  it("updates equipped=false for all armor rows of a character", async () => {
    eqMock.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const { unequipAllArmor } = await import("@/lib/supabase/inventory");
    await unequipAllArmor("char-1");
    expect(updateMock).toHaveBeenCalledWith({ equipped: false });
  });
});
