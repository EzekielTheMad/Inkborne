// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { MpmbParsedEntry, MpmbStaticObject } from "@/lib/import/mpmb/types";
import {
  createMpmbSourceIndex,
  mapMpmbSources,
  resolveMpmbSourceRefs,
} from "@/lib/import/mpmb/map/sources";

const entry = (
  key: string,
  data: MpmbStaticObject,
  registry: MpmbParsedEntry["registry"] = "SourceList",
): MpmbParsedEntry => ({
  registry,
  key,
  data,
  location: { line: 1, column: 1 },
});

describe("MPMB source mapping", () => {
  it("retains supported provenance metadata without treating it as content", () => {
    const [source] = mapMpmbSources([
      entry("IBX", {
        name: "Inkborne Examples",
        abbreviation: "IBX",
        group: "Synthetic fixtures",
        url: "https://example.invalid/source",
        date: "2026-07-20",
        defaultExcluded: true,
      }),
    ]);

    expect(source).toEqual({
      key: "IBX",
      name: "Inkborne Examples",
      abbreviation: "IBX",
      group: "Synthetic fixtures",
      url: "https://example.invalid/source",
      date: "2026-07-20",
      defaultExcluded: true,
      location: { line: 1, column: 1 },
      issues: [],
    });
  });

  it("diagnoses missing names, invalid metadata, and unknown fields", () => {
    const [source] = mapMpmbSources([
      entry("X", {
        name: "",
        group: 42,
        privateLicenseGuess: true,
      }),
    ]);

    expect(source?.abbreviation).toBe("X");
    expect(source?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source.name.required",
          severity: "blocking",
        }),
        expect.objectContaining({ code: "source.group.invalid" }),
        expect.objectContaining({
          code: "unmapped.privateLicenseGuess",
          kind: "unmapped_field",
        }),
      ]),
    );
  });

  it("normalizes one or many source references and deduplicates them", () => {
    const sources = mapMpmbSources([
      entry("IBX", { name: "Inkborne Examples" }),
    ]);
    const sourceIndex = createMpmbSourceIndex(sources);
    const content = entry(
      "spell",
      {},
      "SpellsList",
    );

    expect(resolveMpmbSourceRefs(content, ["IBX", 3], sourceIndex)).toEqual({
      refs: [{ book: "IBX", page: 3 }],
      issues: [],
    });
    expect(
      resolveMpmbSourceRefs(
        content,
        [["IBX", 3], ["IBX", 3], ["PHB", 211]],
        sourceIndex,
      ),
    ).toMatchObject({
      refs: [
        { book: "IBX", page: 3 },
        { book: "PHB", page: 211 },
      ],
      issues: [
        expect.objectContaining({
          code: "source.unknown.PHB",
          severity: "warning",
        }),
      ],
    });
  });

  it("blocks missing or malformed source references", () => {
    const content = entry("spell", {}, "SpellsList");
    expect(resolveMpmbSourceRefs(content, undefined, new Map()).issues).toEqual([
      expect.objectContaining({ code: "source.required", severity: "blocking" }),
    ]);
    expect(resolveMpmbSourceRefs(content, ["IBX"], new Map()).issues).toEqual([
      expect.objectContaining({
        code: "source.invalid_shape",
        severity: "blocking",
      }),
    ]);
  });
});
