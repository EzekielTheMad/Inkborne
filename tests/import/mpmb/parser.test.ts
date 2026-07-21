// @vitest-environment node

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseMpmbSource } from "@/lib/import/mpmb/parser";
import {
  DEFAULT_MPMB_PARSER_LIMITS,
  MpmbParseError,
  type MpmbParseErrorCode,
} from "@/lib/import/mpmb/types";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/mpmb/${name}`, import.meta.url), "utf8");

function expectCode(source: string, code: MpmbParseErrorCode): MpmbParseError {
  try {
    parseMpmbSource(source);
    expect.unreachable("parseMpmbSource should have thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(MpmbParseError);
    expect((error as MpmbParseError).code).toBe(code);
    return error as MpmbParseError;
  }
}

describe("parseMpmbSource", () => {
  it("parses the metadata prelude and all three supported registries", () => {
    const result = parseMpmbSource(fixture("supported-lists.mpmb"));

    expect(result.fileName).toBe("Inkborne Static Parser Fixture.js");
    expect(result.requiredSheetVersion).toBe("13.1.14");
    expect(result.sources.map((entry) => entry.key)).toEqual(["IBX"]);
    expect(result.spells.map((entry) => entry.key)).toEqual(["ember ward"]);
    expect(result.feats.map((entry) => entry.key)).toEqual([
      "steadfast storyteller",
    ]);
    expect(result.limits).toEqual(DEFAULT_MPMB_PARSER_LIMITS);
    expect(Object.isFrozen(result.limits)).toBe(true);
  });

  it("folds nested static data without executing the MPMB helper", () => {
    const result = parseMpmbSource(fixture("supported-lists.mpmb"));
    const spell = result.spells[0]?.data;
    const feat = result.feats[0]?.data;

    expect(spell).toMatchObject({
      name: "Ember Ward",
      level: 1,
      school: "Abj",
      ritual: true,
      description: "A harmless synthetic spell.",
      scaling: { dice: [1, 2, 3], modifier: -2, optional: null },
    });
    expect(Object.getPrototypeOf(spell)).toBeNull();
    expect(Object.getPrototypeOf(spell?.scaling)).toBeNull();
    expect(feat?.description).toEqual({
      type: "mpmb-helper",
      name: "desc",
      arguments: [
        [
          "Tell a synthetic tale.",
          "Gain no mechanical advantage; this is only a parser fixture.",
        ],
      ],
    });
  });

  it("preserves source order and accepts dot or bracket registry keys", () => {
    const result = parseMpmbSource(`
      SourceList.First = { name: "First" };
      SourceList["second"] = { name: "Second" };
      SourceList.third = { name: "Third" };
    `);

    expect(result.sources.map((entry) => entry.key)).toEqual([
      "First",
      "second",
      "third",
    ]);
    expect(result.sources[0]?.location).toEqual({ line: 2, column: 7 });
  });

  it("accepts harmless comments, extra semicolons, and use strict", () => {
    const result = parseMpmbSource(`
      "use strict";
      ; // harmless empty statement
      /* another harmless comment */
      SourceList.X = { name: "Example" };;
    `);
    expect(result.sources).toHaveLength(1);
  });

  it("rejects syntax errors after a valid-looking entry without partial data", () => {
    const error = expectCode(
      fixture("syntax-error-after-entry.mpmb"),
      "SYNTAX_ERROR",
    );

    expect(error.location?.line).toBeGreaterThan(1);
    expect("sources" in error).toBe(false);
  });

  it("rejects duplicate entries, metadata, and object properties", () => {
    expectCode(
      `SourceList.X = {}; SourceList.X = {};`,
      "DUPLICATE_ENTRY",
    );
    expectCode(
      `var iFileName = "one"; var iFileName = "two";`,
      "DUPLICATE_METADATA",
    );
    expectCode(
      `RequiredSheetVersion(13); RequiredSheetVersion("14");`,
      "DUPLICATE_METADATA",
    );
    expectCode(
      `SourceList.X = { name: "one", name: "two" };`,
      "DUPLICATE_PROPERTY",
    );
  });

  it("rejects dangerous keys and dynamic registry targets", () => {
    expectCode(`SourceList.X = { __proto__: {} };`, "DANGEROUS_PROPERTY");
    expectCode(`SourceList["constructor"] = {};`, "DANGEROUS_PROPERTY");
    expectCode(`SourceList[getKey()] = {};`, "DYNAMIC_KEY");
    expectCode(`OtherList.X = {};`, "UNSUPPORTED_REGISTRY");
  });

  it("rejects non-object entries and non-assignment mutations", () => {
    expectCode(`SpellsList.X = "not an object";`, "INVALID_ENTRY");
    expectCode(`SpellsList.X += {};`, "UNSUPPORTED_STATEMENT");
    expectCode(`delete SpellsList.X;`, "UNSUPPORTED_STATEMENT");
  });

  it("rejects unknown top-level calls and declarations", () => {
    expectCode(`doSomething();`, "UNSUPPORTED_STATEMENT");
    expectCode(`const source = ["HB", 0];`, "INVALID_METADATA");
    expectCode(`if (true) SourceList.X = {};`, "UNSUPPORTED_STATEMENT");
  });
});
