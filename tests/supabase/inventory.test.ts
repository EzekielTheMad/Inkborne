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

const validItemDefinition = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Rope",
  slug: "rope",
  content_type: "item",
  version: 1,
  source: "srd",
  system_id: "22222222-2222-4222-8222-222222222222",
  scope: "platform",
  owner_id: null,
  effects: [],
  data: {
    equipment_category: "Adventuring Gear",
    cost: { quantity: 1, unit: "gp" },
    weight: 10,
    description: "Fifty feet of hempen rope.",
  },
};

const structuredError = {
  code: "42501",
  message: "permission denied for table content_definitions",
  details: null,
  hint: "Grant SELECT to authenticated",
};

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
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("version"));
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("source"));
  });

  it("retains a valid parent row but nulls a malformed joined definition", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    orderMock.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "inv-1",
            character_id: "char-1",
            content_id: "bad-content",
            name: "Custom item",
            content_definitions: {
              ...validItemDefinition,
              data: { weight: "heavy" },
            },
          },
        ],
        error: null,
      }),
    });

    const { getInventoryForCharacter } = await import("@/lib/supabase/inventory");
    const result = await getInventoryForCharacter("char-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "inv-1", name: "Custom item" });
    expect(result[0].content_definitions).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad data for rope (item)"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("rejects with the original structured query error", async () => {
    orderMock.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: null, error: structuredError }),
    });

    const { getInventoryForCharacter } = await import("@/lib/supabase/inventory");

    await expect(getInventoryForCharacter("char-1")).rejects.toBe(structuredError);
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

  it("rejects with the original structured insert error", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: structuredError });
    const { addInventoryItem } = await import("@/lib/supabase/inventory");

    await expect(
      addInventoryItem("char-1", {
        content_id: "c1",
        name: "Longsword",
        content_type: "weapon",
      }),
    ).rejects.toBe(structuredError);
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

  it("rejects with the original structured update error", async () => {
    eqMock.mockResolvedValueOnce({ error: structuredError });
    const { updateInventoryItem } = await import("@/lib/supabase/inventory");

    await expect(
      updateInventoryItem("inv-1", { equipped: true }),
    ).rejects.toBe(structuredError);
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

describe("searchItems", () => {
  it("validates results and omits only malformed definitions", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    limitMock.mockResolvedValueOnce({
      data: [
        validItemDefinition,
        {
          ...validItemDefinition,
          id: "33333333-3333-4333-8333-333333333333",
          slug: "broken-item",
          data: { weight: "heavy" },
        },
      ],
      error: null,
    });

    const { searchItems } = await import("@/lib/supabase/inventory");
    const result = await searchItems(validItemDefinition.system_id, "rope");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "rope",
      version: 1,
      source: "srd",
    });
    expect(eqMock).toHaveBeenCalledWith("scope", "platform");
    expect(inMock).toHaveBeenCalledWith("content_type", [
      "weapon",
      "armor",
      "item",
      "magic_item",
    ]);
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("version"));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("rejects with the original structured query error", async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: structuredError });

    const { searchItems } = await import("@/lib/supabase/inventory");

    await expect(searchItems("sys-1", "rope")).rejects.toBe(structuredError);
  });
});
