import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
  getContentRefsByCharacter,
  addContentRef,
  removeContentRef,
  removeContentRefsByChoiceSource,
  getContentRefsByChoiceSource,
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs";

// Browser-mock harness (for insertContentRef / removeContentRefById).
// Built standalone so it doesn't interact with the server harness below.
const mockBrowserSingle = vi.fn();
const mockBrowserSelect = vi.fn(() => ({ single: mockBrowserSingle }));
const mockBrowserInsert = vi.fn(() => ({ select: mockBrowserSelect }));
const mockBrowserEq = vi.fn();
const mockBrowserDelete = vi.fn(() => ({ eq: mockBrowserEq }));
const mockBrowserFrom = vi.fn(() => ({
  insert: mockBrowserInsert,
  delete: mockBrowserDelete,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockBrowserFrom }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockImplementation(() => chain);
  // For non-single terminal calls
  chain.delete.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);

  const supabase = {
    from: vi.fn().mockReturnValue(chain),
  };

  mockedCreateClient.mockResolvedValue(supabase as never);

  return { supabase, chain };
}

describe("getContentRefsByCharacter", () => {
  it("queries refs with joined content definitions", async () => {
    const refs = [{ id: "r1", content_id: "c1" }];
    const { chain } = mockSupabase(refs);
    // Override: the terminal call for this is the select chain, not single
    chain.eq.mockResolvedValue({ data: refs, error: null });

    const result = await getContentRefsByCharacter("char-1");

    expect(result).toEqual(refs);
  });
});

describe("addContentRef", () => {
  it("inserts a content ref and returns the result", async () => {
    const ref = { id: "r1", character_id: "c1", content_id: "cd1" };
    const { chain } = mockSupabase(ref);

    const result = await addContentRef({
      character_id: "c1",
      content_id: "cd1",
      content_version: 1,
      context: { source: "class", level: 1 },
    });

    expect(result).toEqual(ref);
  });
});

describe("removeContentRefsByChoiceSource", () => {
  it("deletes refs matching character and choice_source", async () => {
    const { chain } = mockSupabase(null);
    // Chain stays chainable; last eq resolves the promise
    let callCount = 0;
    chain.eq.mockImplementation(() => {
      callCount++;
      if (callCount >= 2) {
        return Promise.resolve({ data: null, error: null });
      }
      return chain;
    });

    await removeContentRefsByChoiceSource("char-1", "choice-skill-1");

    expect(chain.delete).toHaveBeenCalled();
  });
});

describe("insertContentRef (browser)", () => {
  beforeEach(() => {
    mockBrowserSingle.mockReset();
    mockBrowserSelect.mockClear();
    mockBrowserInsert.mockClear();
    mockBrowserFrom.mockClear();
  });

  it("inserts a content_ref row and returns the inserted row", async () => {
    const inserted = { id: "r1", character_id: "c1", content_id: "cd1" };
    mockBrowserSingle.mockResolvedValue({ data: inserted, error: null });
    const result = await insertContentRef({
      characterId: "c1",
      contentId: "cd1",
      contentVersion: 1,
      context: { source: "class", level: 1 },
    });
    expect(mockBrowserFrom).toHaveBeenCalledWith("character_content_refs");
    expect(mockBrowserInsert).toHaveBeenCalledWith([
      {
        character_id: "c1",
        content_id: "cd1",
        content_version: 1,
        context: { source: "class", level: 1 },
        choice_source: null,
      },
    ]);
    expect(result).toEqual(inserted);
  });

  it("passes a non-null choiceSource through to the row", async () => {
    const inserted = { id: "r2", character_id: "c1", content_id: "cd2" };
    mockBrowserSingle.mockResolvedValue({ data: inserted, error: null });
    await insertContentRef({
      characterId: "c1",
      contentId: "cd2",
      contentVersion: 1,
      context: { source: "choice" },
      choiceSource: "choice-feature-1",
    });
    expect(mockBrowserInsert).toHaveBeenCalledWith([
      {
        character_id: "c1",
        content_id: "cd2",
        content_version: 1,
        context: { source: "choice" },
        choice_source: "choice-feature-1",
      },
    ]);
  });

  it("throws when supabase returns an error", async () => {
    mockBrowserSingle.mockResolvedValue({
      data: null,
      error: { message: "fk violation" },
    });
    await expect(
      insertContentRef({
        characterId: "c1",
        contentId: "cd1",
        contentVersion: 1,
        context: { source: "class", level: 1 },
      }),
    ).rejects.toThrow("fk violation");
  });
});

describe("removeContentRefById (browser)", () => {
  beforeEach(() => {
    mockBrowserEq.mockReset();
    mockBrowserDelete.mockClear();
    mockBrowserFrom.mockClear();
  });

  it("deletes the content_ref row matching id", async () => {
    mockBrowserEq.mockResolvedValue({ error: null });
    await removeContentRefById("r1");
    expect(mockBrowserFrom).toHaveBeenCalledWith("character_content_refs");
    expect(mockBrowserDelete).toHaveBeenCalled();
    expect(mockBrowserEq).toHaveBeenCalledWith("id", "r1");
  });

  it("throws when supabase returns an error", async () => {
    mockBrowserEq.mockResolvedValue({ error: { message: "RLS denied" } });
    await expect(removeContentRefById("r1")).rejects.toThrow("RLS denied");
  });
});
