import { describe, expect, it, vi } from "vitest";

import {
  parseContentDefinition,
  parseContentDefinitions,
  parseNestedContentDefinition,
} from "@/lib/supabase/content-definitions-parser";

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

describe("parseContentDefinition", () => {
  it("is runtime-neutral and returns a validated definition", () => {
    const result = parseContentDefinition(validClassRow);

    expect(result).toMatchObject({
      id: validClassRow.id,
      content_type: "class",
      slug: "wizard",
      source: "srd",
    });
    expect(result?.data.hit_die).toBe(6);
  });

  it("returns null when the envelope or id is invalid", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(parseContentDefinition({ slug: "bad-row", id: "not-a-uuid" })).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad envelope for bad-row"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("returns null for an unregistered content type", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      parseContentDefinition({
        ...validClassRow,
        content_type: "imaginary-type",
      }),
    ).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown content_type"),
      "imaginary-type",
    );
    errorSpy.mockRestore();
  });

  it("returns null when the type-specific data is invalid", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      parseContentDefinition({
        ...validClassRow,
        data: { hit_die: "not a number" },
      }),
    ).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad data for wizard (class)"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });
});

describe("parseContentDefinitions", () => {
  it("preserves valid rows while dropping only malformed rows", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = parseContentDefinitions([
      validClassRow,
      { ...validClassRow, id: "bad-id", slug: "bad" },
      { ...validClassRow, id: "33333333-3333-4333-8333-333333333333", slug: "mage" },
    ]);

    expect(result.map((row) => row.slug)).toEqual(["wizard", "mage"]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});

describe("parseNestedContentDefinition", () => {
  it("accepts object and single-element PostgREST join shapes", () => {
    expect(parseNestedContentDefinition(validClassRow)?.slug).toBe("wizard");
    expect(parseNestedContentDefinition([validClassRow])?.slug).toBe("wizard");
  });

  it("keeps absent joins null without logging", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(parseNestedContentDefinition(null)).toBeNull();
    expect(parseNestedContentDefinition([])).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("rejects ambiguous multi-row joins", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(parseNestedContentDefinition([validClassRow, validClassRow])).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Expected one joined definition"),
    );
    errorSpy.mockRestore();
  });
});
