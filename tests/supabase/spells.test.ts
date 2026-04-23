import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const ilikeMock = vi.fn();
const containsMock = vi.fn();
const singleMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: (table: string) => fromMock(table) }),
}));

function makeChain() {
  return {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    eq: eqMock,
    in: inMock,
    order: orderMock,
    limit: limitMock,
    ilike: ilikeMock,
    contains: containsMock,
    single: singleMock,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const chain = makeChain();
  selectMock.mockReturnValue(chain);
  insertMock.mockReturnValue(chain);
  updateMock.mockReturnValue(chain);
  deleteMock.mockReturnValue(chain);
  eqMock.mockReturnValue(chain);
  inMock.mockReturnValue(chain);
  orderMock.mockReturnValue(chain);
  limitMock.mockResolvedValue({ data: [], error: null });
  ilikeMock.mockReturnValue(chain);
  containsMock.mockReturnValue(chain);
  singleMock.mockResolvedValue({ data: {}, error: null });
  fromMock.mockReturnValue(chain);
});

describe("getSpellsForCharacter", () => {
  it("queries character_spells with join and character_id filter", async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null });
    const { getSpellsForCharacter } = await import("@/lib/supabase/spells");
    await getSpellsForCharacter("char-1");
    expect(fromMock).toHaveBeenCalledWith("character_spells");
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("content_definitions"),
    );
    expect(eqMock).toHaveBeenCalledWith("character_id", "char-1");
  });
});

describe("addCharacterSpell", () => {
  it("inserts with character_id, class_slug, and selection source", async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: "spell-1",
        character_id: "char-1",
        content_id: "c1",
        name: "Fireball",
        class_slug: "wizard",
      },
      error: null,
    });
    const { addCharacterSpell } = await import("@/lib/supabase/spells");
    await addCharacterSpell("char-1", {
      content_id: "c1",
      name: "Fireball",
      class_slug: "wizard",
      is_known: true,
      is_prepared: true,
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        character_id: "char-1",
        content_id: "c1",
        name: "Fireball",
        class_slug: "wizard",
        is_known: true,
        is_prepared: true,
        source: "selection",
      }),
    );
  });
});

describe("updateCharacterSpell", () => {
  it("updates the spell with patch and eq by id", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { updateCharacterSpell } = await import("@/lib/supabase/spells");
    await updateCharacterSpell("spell-1", { is_prepared: true });
    expect(updateMock).toHaveBeenCalledWith({ is_prepared: true });
    expect(eqMock).toHaveBeenCalledWith("id", "spell-1");
  });
});

describe("removeCharacterSpell", () => {
  it("deletes the spell by id", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const { removeCharacterSpell } = await import("@/lib/supabase/spells");
    await removeCharacterSpell("spell-1");
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "spell-1");
  });
});

describe("searchSpells", () => {
  it("filters by class, level, and platform scope", async () => {
    const { searchSpells } = await import("@/lib/supabase/spells");
    await searchSpells("sys-1", "fire", { classSlug: "wizard", level: 3 });
    expect(fromMock).toHaveBeenCalledWith("content_definitions");
    expect(eqMock).toHaveBeenCalledWith("system_id", "sys-1");
    expect(eqMock).toHaveBeenCalledWith("content_type", "spell");
    expect(eqMock).toHaveBeenCalledWith("scope", "platform");
    expect(eqMock).toHaveBeenCalledWith("data->>level", "3");
    expect(ilikeMock).toHaveBeenCalledWith("name", "%fire%");
    expect(containsMock).toHaveBeenCalledWith("data->classes", JSON.stringify(["wizard"]));
  });
});
