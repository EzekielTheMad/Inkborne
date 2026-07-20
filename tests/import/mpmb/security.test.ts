// @vitest-environment node

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseMpmbSource } from "@/lib/import/mpmb/parser";
import {
  DEFAULT_MPMB_PARSER_LIMITS,
  MpmbParseError,
  type MpmbParseErrorCode,
  type MpmbParserLimits,
} from "@/lib/import/mpmb/types";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/mpmb/${name}`, import.meta.url), "utf8");

function expectLimit(
  source: string,
  limit: Partial<MpmbParserLimits>,
  code: MpmbParseErrorCode,
) {
  try {
    parseMpmbSource(source, { limits: limit });
    expect.unreachable("limit should have rejected the source");
  } catch (error) {
    expect(error).toBeInstanceOf(MpmbParseError);
    expect((error as MpmbParseError).code).toBe(code);
  }
}

describe("MPMB parser security boundary", () => {
  it("never executes a file containing a global side effect", () => {
    const globals = globalThis as typeof globalThis & {
      __inkborneMpmbExecuted?: boolean;
    };
    delete globals.__inkborneMpmbExecuted;

    expect(() => parseMpmbSource(fixture("global-side-effect.mpmb"))).toThrow(
      MpmbParseError,
    );
    expect(globals.__inkborneMpmbExecuted).toBeUndefined();
  });

  it("rejects function-valued mechanics rather than capturing or running them", () => {
    expect(() => parseMpmbSource(fixture("unsupported-function.mpmb"))).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_EXPRESSION" }),
    );
  });

  it("enforces source byte and token ceilings", () => {
    expectLimit("é", { maxSourceBytes: 1 }, "SOURCE_TOO_LARGE");
    expectLimit(
      `SourceList.X = { name: "X" };`,
      { maxTokens: 3 },
      "TOKEN_LIMIT",
    );
  });

  it("enforces AST node and depth ceilings", () => {
    expectLimit(
      `SourceList.X = { name: "X" };`,
      { maxAstNodes: 4 },
      "AST_NODE_LIMIT",
    );
    expectLimit(
      `SourceList.X = { a: { b: { c: true } } };`,
      { maxAstDepth: 5 },
      "AST_DEPTH_LIMIT",
    );
  });

  it("enforces statement and entry ceilings independently", () => {
    const twoEntries = `SourceList.A = {}; SourceList.B = {};`;
    expectLimit(
      twoEntries,
      { maxTopLevelStatements: 1 },
      "STATEMENT_LIMIT",
    );
    expectLimit(twoEntries, { maxEntries: 1 }, "ENTRY_LIMIT");
  });

  it("enforces object, array, and key ceilings", () => {
    expectLimit(
      `SourceList.X = { a: 1, b: 2 };`,
      { maxObjectProperties: 1 },
      "OBJECT_PROPERTY_LIMIT",
    );
    expectLimit(
      `SourceList.X = { values: [1, 2] };`,
      { maxArrayElements: 1 },
      "ARRAY_ELEMENT_LIMIT",
    );
    expectLimit(
      `SourceList.XX = {};`,
      { maxKeyLength: 1 },
      "KEY_LENGTH_LIMIT",
    );
  });

  it("enforces individual and aggregate decoded-string ceilings", () => {
    expectLimit(
      `SourceList.X = { a: "four" };`,
      { maxStringLength: 3 },
      "STRING_LENGTH_LIMIT",
    );
    expect(parseMpmbSource(`SourceList.X = { a: "b" };`, {
      limits: { maxTotalStringLength: 3 },
    }).sources).toHaveLength(1);
    expectLimit(
      `SourceList.X = { a: "b" };`,
      { maxTotalStringLength: 2 },
      "TOTAL_STRING_LENGTH_LIMIT",
    );
  });

  it("allows limits to tighten hard ceilings but never raise or disable them", () => {
    const result = parseMpmbSource("", { limits: { maxEntries: 1 } });
    expect(result.limits.maxEntries).toBe(1);
    expect(Object.isFrozen(result.limits)).toBe(true);

    expectLimit("", { maxEntries: 0 }, "INVALID_LIMITS");
    expectLimit(
      "",
      { maxEntries: DEFAULT_MPMB_PARSER_LIMITS.maxEntries + 1 },
      "INVALID_LIMITS",
    );
  });

  it("is deterministic and produces no prototype-bearing imported objects", () => {
    const source = fixture("supported-lists.mpmb");
    const first = parseMpmbSource(source);
    const second = parseMpmbSource(source);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.getPrototypeOf(first.sources[0]?.data)).toBeNull();
    expect(Object.getPrototypeOf(first.spells[0]?.data.scaling)).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("contains no execution-runtime escape hatch", () => {
    const modules = ["parser.ts", "fold.ts", "limits.ts"].map((name) =>
      readFileSync(
        new URL(`../../../lib/import/mpmb/${name}`, import.meta.url),
        "utf8",
      ),
    );
    const source = modules.join("\n");

    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\b/);
    expect(source).not.toMatch(/from\s+["'](?:node:)?(?:vm|child_process)["']/);
    expect(source).not.toMatch(/quickjs/i);
    expect(source).not.toMatch(/import\s*\(/);
    expect(source).not.toMatch(/from\s+["'](?:react|next|@supabase)/);
  });
});
