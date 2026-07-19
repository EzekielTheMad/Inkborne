import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { syncAlwaysPreparedSpells } from "@/lib/supabase/spells-server";

interface QueryResponse<T> {
  data?: T;
  error: { message: string } | null;
}

function makeQuery<T>(response: QueryResponse<T>) {
  const query = {
    eq: vi.fn(),
    in: vi.fn(),
    then: <TResult1 = QueryResponse<T>, TResult2 = never>(
      onFulfilled?: ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
  };
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  return query;
}

function makeClient(options?: {
  existing?: Array<{ id: string; class_slug: string; content_id: string | null }>;
  definitions?: Array<{ id: string; slug: string; name: string }>;
  existingError?: { message: string } | null;
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const existingQuery = makeQuery({
    data: options?.existing ?? [],
    error: options?.existingError ?? null,
  });
  const definitionQuery = makeQuery({
    data: options?.definitions ?? [],
    error: null,
  });
  const deleteQuery = makeQuery({
    data: null,
    error: options?.deleteError ?? null,
  });

  const characterSpells = {
    select: vi.fn(() => existingQuery),
    insert: vi.fn().mockResolvedValue({ error: options?.insertError ?? null }),
    delete: vi.fn(() => deleteQuery),
  };
  const contentDefinitions = {
    select: vi.fn(() => definitionQuery),
  };
  const from = vi.fn((table: string) => {
    if (table === "character_spells") return characterSpells;
    if (table === "content_definitions") return contentDefinitions;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as Parameters<typeof syncAlwaysPreparedSpells>[0],
    from,
    existingQuery,
    definitionQuery,
    characterSpells,
    contentDefinitions,
    deleteQuery,
  };
}

describe("syncAlwaysPreparedSpells", () => {
  it("inserts missing grants and removes stale, duplicate, and invalid rows", async () => {
    const db = makeClient({
      existing: [
        { id: "keep", class_slug: "cleric", content_id: "spell-bless" },
        { id: "stale", class_slug: "cleric", content_id: "spell-old" },
        { id: "duplicate", class_slug: "cleric", content_id: "spell-bless" },
        { id: "invalid", class_slug: "cleric", content_id: null },
      ],
      definitions: [
        { id: "spell-bless", slug: "bless", name: "Bless" },
        { id: "spell-aid", slug: "aid", name: "Aid" },
      ],
    });

    const result = await syncAlwaysPreparedSpells(db.client, {
      characterId: "char-1",
      systemId: "system-1",
      granted: [
        { spell_slug: "bless", class_slug: "cleric" },
        { spell_slug: "bless", class_slug: "cleric" },
        { spell_slug: "aid", class_slug: "cleric" },
        { spell_slug: "missing", class_slug: "cleric" },
      ],
    });

    expect(db.definitionQuery.eq).toHaveBeenCalledWith("system_id", "system-1");
    expect(db.characterSpells.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        character_id: "char-1",
        content_id: "spell-aid",
        name: "Aid",
        class_slug: "cleric",
        always_prepared: true,
        source: "feature",
      }),
    ]);
    expect(db.deleteQuery.in).toHaveBeenCalledWith(
      "id",
      expect.arrayContaining(["stale", "duplicate", "invalid"]),
    );
    expect(result).toEqual({
      inserted: 1,
      deleted: 3,
      missingSpellSlugs: ["missing"],
    });
  });

  it("removes all feature rows when no grants remain", async () => {
    const db = makeClient({
      existing: [
        { id: "old-1", class_slug: "cleric", content_id: "spell-1" },
        { id: "old-2", class_slug: "paladin", content_id: "spell-2" },
      ],
    });

    const result = await syncAlwaysPreparedSpells(db.client, {
      characterId: "char-1",
      systemId: "system-1",
      granted: [],
    });

    expect(db.contentDefinitions.select).not.toHaveBeenCalled();
    expect(db.characterSpells.insert).not.toHaveBeenCalled();
    expect(db.deleteQuery.in).toHaveBeenCalledWith(
      "id",
      expect.arrayContaining(["old-1", "old-2"]),
    );
    expect(result).toEqual({ inserted: 0, deleted: 2, missingSpellSlugs: [] });
  });

  it("throws instead of silently continuing after a database error", async () => {
    const db = makeClient({ existingError: { message: "permission denied" } });

    await expect(
      syncAlwaysPreparedSpells(db.client, {
        characterId: "char-1",
        systemId: "system-1",
        granted: [],
      }),
    ).rejects.toThrow("loading existing feature spells failed: permission denied");

    expect(db.characterSpells.insert).not.toHaveBeenCalled();
    expect(db.characterSpells.delete).not.toHaveBeenCalled();
  });
});
