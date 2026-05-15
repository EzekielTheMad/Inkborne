import { describe, it, expect, vi, beforeEach } from "vitest";

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

import {
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs-client";

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
