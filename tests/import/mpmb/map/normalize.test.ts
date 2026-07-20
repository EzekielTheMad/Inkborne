// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  normalizeAbility,
  normalizeSlug,
  normalizeStringList,
  readStaticText,
} from "@/lib/import/mpmb/map/normalize";

describe("MPMB mapper normalization", () => {
  it("creates deterministic ASCII slugs", () => {
    expect(normalizeSlug("  Émber Ward! ")).toBe("ember-ward");
    expect(normalizeSlug("Already--Spaced")).toBe("already-spaced");
  });

  it("normalizes ability names, abbreviations, and MPMB numeric indexes", () => {
    expect(normalizeAbility("STR")).toBe("strength");
    expect(normalizeAbility("Charisma")).toBe("charisma");
    expect(normalizeAbility(4)).toBe("intelligence");
    expect(normalizeAbility(7)).toBeNull();
  });

  it("deduplicates normalized string lists", () => {
    expect(normalizeStringList([" Wizard ", "wizard", "Bard"])).toEqual([
      "wizard",
      "bard",
    ]);
    expect(normalizeStringList(["wizard", 42])).toBeNull();
  });

  it("reads strings, arrays, and symbolic desc helpers without executing them", () => {
    expect(readStaticText(" one ")).toBe("one");
    expect(readStaticText(["one", "two"])).toBe("one\ntwo");
    expect(
      readStaticText({
        type: "mpmb-helper",
        name: "desc",
        arguments: [["one", "two"]],
      }),
    ).toBe("one\ntwo");
    expect(
      readStaticText({
        type: "mpmb-helper",
        name: "unknown" as never,
        arguments: [["one"]],
      }),
    ).toBeNull();
  });
});
