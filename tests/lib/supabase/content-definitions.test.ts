import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockOrder = vi.fn();
const mockEq2 = vi.fn(() => ({ order: mockOrder }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ from: mockFrom }),
}));

import { getContentByType } from "@/lib/supabase/content-definitions";

const validClassRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Wizard",
  slug: "wizard",
  content_type: "class",
  version: 1,
  source: "srd",
  system_id: "22222222-2222-4222-8222-222222222222",
  scope: "platform",
  owner_id: null,
  effects: [],
  data: {
    hit_die: 6,
    spellcasting: null,
    multiclass: { prerequisites: [], proficiencies_gained: [] },
    saving_throws: ["intelligence", "wisdom"],
    starting_proficiencies: [],
    levels: [{ level: 1, features: [], spellcasting: null }],
    source_refs: [],
  },
};

describe("getContentByType", () => {
  beforeEach(() => {
    mockOrder.mockReset();
    mockEq2.mockClear();
    mockEq1.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  it("returns parsed rows after a successful fetch", async () => {
    mockOrder.mockResolvedValue({ data: [validClassRow], error: null });

    const result = await getContentByType(
      "22222222-2222-4222-8222-222222222222",
      "class",
    );

    expect(mockFrom).toHaveBeenCalledWith("content_definitions");
    expect(mockEq1).toHaveBeenCalledWith(
      "system_id",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(mockEq2).toHaveBeenCalledWith("content_type", "class");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("wizard");
  });

  it("drops a malformed row without discarding valid rows", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockOrder.mockResolvedValue({
      data: [
        validClassRow,
        { ...validClassRow, slug: "broken", data: { hit_die: "x" } },
      ],
      error: null,
    });

    const result = await getContentByType(
      "22222222-2222-4222-8222-222222222222",
      "class",
    );

    expect(result.map((row) => row.slug)).toEqual(["wizard"]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad data for broken (class)"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("returns an empty array for a successful fetch with no rows", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await expect(
      getContentByType(
        "22222222-2222-4222-8222-222222222222",
        "class",
      ),
    ).resolves.toEqual([]);
  });

  it("rejects with the original structured Supabase error", async () => {
    const queryError = {
      code: "42501",
      message: "permission denied for table content_definitions",
      details: null,
      hint: "Grant SELECT to the authenticated role",
    };
    mockOrder.mockResolvedValue({ data: null, error: queryError });

    await expect(
      getContentByType(
        "22222222-2222-4222-8222-222222222222",
        "class",
      ),
    ).rejects.toBe(queryError);
  });
});
