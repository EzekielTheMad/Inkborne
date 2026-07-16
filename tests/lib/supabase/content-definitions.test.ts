import { describe, it, expect, vi, beforeEach } from "vitest";

// Browser-mock harness mirroring tests/lib/supabase/content-refs.test.ts.
const mockOrder = vi.fn();
const mockEq2 = vi.fn(() => ({ order: mockOrder }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ from: mockFrom }),
}));

import {
  getContentByType,
  parseContentDefinition,
} from "@/lib/supabase/content-definitions";

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
    levels: [
      {
        level: 1,
        features: [],
        spellcasting: null,
      },
    ],
    source_refs: [],
  },
};

describe("parseContentDefinition", () => {
  it("returns ParsedContentDefinition for a valid row", () => {
    const result = parseContentDefinition(validClassRow);
    expect(result).not.toBeNull();
    expect(result?.content_type).toBe("class");
    expect(result?.slug).toBe("wizard");
    expect((result?.data as { hit_die: number }).hit_die).toBe(6);
  });

  it("returns null when the envelope is invalid (logs)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseContentDefinition({
      slug: "bad-row",
      // missing name, content_type, etc.
    });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad envelope"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("returns null when content_type has no registered schema (logs)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseContentDefinition({
      ...validClassRow,
      content_type: "imaginary-type",
    });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown content_type"),
      "imaginary-type",
    );
    errorSpy.mockRestore();
  });

  it("returns null when inner data fails the content-type schema (logs)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseContentDefinition({
      ...validClassRow,
      data: { hit_die: "not a number" }, // hit_die must be positive int
    });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad data for wizard (class)"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });
});

describe("getContentByType", () => {
  beforeEach(() => {
    mockOrder.mockReset();
    mockEq2.mockClear();
    mockEq1.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
  });

  it("returns parsed rows when all envelope + data shapes are valid", async () => {
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

  it("drops bad rows and keeps good ones in the same fetch", async () => {
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
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("wizard");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns empty array and logs on supabase error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockOrder.mockResolvedValue({ data: null, error: { message: "RLS denied" } });
    const result = await getContentByType(
      "22222222-2222-4222-8222-222222222222",
      "class",
    );
    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Supabase error fetching class"),
      "RLS denied",
    );
    errorSpy.mockRestore();
  });
});
