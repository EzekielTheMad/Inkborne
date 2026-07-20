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

const validSpellDefinition = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Fire Bolt",
  slug: "fire-bolt",
  content_type: "spell",
  version: 1,
  source: "srd",
  system_id: "22222222-2222-4222-8222-222222222222",
  scope: "platform",
  owner_id: null,
  effects: [],
  data: {
    level: 0,
    school: "evocation",
    casting_time: "1 action",
    range: "120 feet",
    components: ["V", "S"],
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    description: "A mote of fire streaks toward a creature.",
    damage: {
      type: "fire",
      dice_at_slot_level: { "1": "1d10" },
    },
    dc: null,
    area_of_effect: null,
    classes: ["wizard"],
    subclasses: [],
  },
};

const structuredError = {
  code: "42501",
  message: "permission denied for table content_definitions",
  details: null,
  hint: "Grant SELECT to authenticated",
};

function snapshotFor(
  definition: typeof validSpellDefinition,
  overrides: Record<string, unknown> = {},
) {
  return {
    content_id: definition.id,
    version: definition.version,
    system_id_snapshot: definition.system_id,
    content_type_snapshot: definition.content_type,
    slug_snapshot: definition.slug,
    name_snapshot: definition.name,
    data_snapshot: definition.data,
    effects_snapshot: definition.effects,
    source_snapshot: definition.source,
    scope_snapshot: definition.scope,
    owner_id_snapshot: definition.owner_id,
    ...overrides,
  };
}

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
  it("queries character_spells with an exact content version join", async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null });
    const { getSpellsForCharacter } = await import("@/lib/supabase/spells");
    await getSpellsForCharacter("char-1");
    expect(fromMock).toHaveBeenCalledWith("character_spells");
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("content_versions!character_spells_content_version_fkey"),
    );
    expect(eqMock).toHaveBeenCalledWith("character_id", "char-1");
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("version"));
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("source"));
  });

  it("retains a valid parent row but nulls a malformed joined definition", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    orderMock.mockResolvedValueOnce({
      data: [
        {
          id: "spell-1",
          character_id: "char-1",
          content_id: "bad-content",
          name: "Custom spell",
          content_versions: snapshotFor(validSpellDefinition, {
            data_snapshot: { level: "not-a-number" },
          }),
        },
      ],
      error: null,
    });

    const { getSpellsForCharacter } = await import("@/lib/supabase/spells");
    const result = await getSpellsForCharacter("char-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "spell-1", name: "Custom spell" });
    expect(result[0].content_definitions).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad data for fire-bolt (spell)"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("rejects with the original structured query error", async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: structuredError });

    const { getSpellsForCharacter } = await import("@/lib/supabase/spells");

    await expect(getSpellsForCharacter("char-1")).rejects.toBe(structuredError);
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
      content_version: 1,
      name: "Fireball",
      class_slug: "wizard",
      is_known: true,
      is_prepared: true,
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        character_id: "char-1",
        content_id: "c1",
        content_version: 1,
        name: "Fireball",
        class_slug: "wizard",
        is_known: true,
        is_prepared: true,
        source: "selection",
      }),
    );
  });

  it("rejects with the original structured insert error", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: structuredError });
    const { addCharacterSpell } = await import("@/lib/supabase/spells");

    await expect(
      addCharacterSpell("char-1", {
        content_id: "c1",
        content_version: 1,
        name: "Fireball",
        class_slug: "wizard",
      }),
    ).rejects.toBe(structuredError);
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

  it("rejects with the original structured update error", async () => {
    eqMock.mockResolvedValueOnce({ error: structuredError });
    const { updateCharacterSpell } = await import("@/lib/supabase/spells");

    await expect(
      updateCharacterSpell("spell-1", { is_prepared: true }),
    ).rejects.toBe(structuredError);
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
  it("filters by class and level while relying on RLS for visible scopes", async () => {
    const { searchSpells } = await import("@/lib/supabase/spells");
    await searchSpells("sys-1", "fire", { classSlug: "wizard", level: 3 });
    expect(fromMock).toHaveBeenCalledWith("content_definitions");
    expect(eqMock).toHaveBeenCalledWith("system_id", "sys-1");
    expect(eqMock).toHaveBeenCalledWith("content_type", "spell");
    expect(eqMock).not.toHaveBeenCalledWith("scope", "platform");
    expect(eqMock).toHaveBeenCalledWith("data->>level", "3");
    expect(ilikeMock).toHaveBeenCalledWith("name", "%fire%");
    expect(containsMock).toHaveBeenCalledWith("data->classes", JSON.stringify(["wizard"]));
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("version"));
  });

  it("validates results and omits only malformed definitions", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    limitMock.mockResolvedValueOnce({
      data: [
        validSpellDefinition,
        {
          ...validSpellDefinition,
          id: "33333333-3333-4333-8333-333333333333",
          slug: "broken-spell",
          data: { level: "three" },
        },
      ],
      error: null,
    });

    const { searchSpells } = await import("@/lib/supabase/spells");
    const result = await searchSpells(validSpellDefinition.system_id, "fire");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "fire-bolt",
      version: 1,
      source: "srd",
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("rejects with the original structured query error", async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: structuredError });

    const { searchSpells } = await import("@/lib/supabase/spells");

    await expect(searchSpells("sys-1", "fire")).rejects.toBe(structuredError);
  });
});
