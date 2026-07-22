import { describe, expect, it, vi } from "vitest";

import {
  parseContentDefinition,
  parseContentDefinitions,
  parseNestedContentDefinition,
  parseContentVersionSnapshot,
  parseNestedContentVersionSnapshot,
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
    description: "A scholarly magic-user capable of manipulating reality",
    hit_die: 6,
    spellcasting: null,
    multiclass: { prerequisites: [], proficiencies_gained: [] },
    saving_throws: ["intelligence", "wisdom"],
    starting_proficiencies: [],
    levels: [{ level: 1, features: [], spellcasting: null }],
    source_refs: [],
  },
};

const validClassSnapshot = {
  content_id: validClassRow.id,
  version: validClassRow.version,
  system_id_snapshot: validClassRow.system_id,
  content_type_snapshot: validClassRow.content_type,
  slug_snapshot: validClassRow.slug,
  name_snapshot: validClassRow.name,
  data_snapshot: validClassRow.data,
  effects_snapshot: validClassRow.effects,
  source_snapshot: validClassRow.source,
  scope_snapshot: validClassRow.scope,
  owner_id_snapshot: validClassRow.owner_id,
};

describe("parseContentDefinition", () => {
  it("is runtime-neutral and returns a validated definition", () => {
    const result = parseContentDefinition(validClassRow);

    expect(result).toMatchObject({
      id: validClassRow.id,
      system_id: validClassRow.system_id,
      content_type: "class",
      slug: "wizard",
      source: "srd",
      scope: "platform",
      owner_id: null,
    });
    expect(result?.data.hit_die).toBe(6);
    expect(result?.data.description).toBe(validClassRow.data.description);
  });

  it("preserves access metadata from a selected row", () => {
    const ownerId = "33333333-3333-4333-8333-333333333333";

    expect(
      parseContentDefinition({
        ...validClassRow,
        source: "homebrew",
        scope: "shared",
        owner_id: ownerId,
      }),
    ).toMatchObject({
      system_id: validClassRow.system_id,
      scope: "shared",
      owner_id: ownerId,
    });
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

describe("parseContentVersionSnapshot", () => {
  it("maps an immutable snapshot into a validated definition", () => {
    expect(parseContentVersionSnapshot(validClassSnapshot)).toMatchObject({
      id: validClassRow.id,
      version: 1,
      slug: "wizard",
      name: "Wizard",
      content_type: "class",
      source: "srd",
      system_id: validClassRow.system_id,
      scope: "platform",
      owner_id: null,
      data: { hit_die: 6 },
    });
  });

  it("accepts the to-one PostgREST relationship shapes", () => {
    expect(parseNestedContentVersionSnapshot(validClassSnapshot)?.slug).toBe(
      "wizard",
    );
    expect(
      parseNestedContentVersionSnapshot([validClassSnapshot])?.slug,
    ).toBe("wizard");
  });

  it("fails closed for malformed snapshots", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      parseContentVersionSnapshot({
        ...validClassSnapshot,
        version: 0,
      }),
    ).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad snapshot"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });
});
