// @vitest-environment node

import { parse, type Expression, type ExpressionStatement } from "acorn";
import { describe, expect, it } from "vitest";

import {
  createMpmbFoldContext,
  foldMpmbStaticExpression,
} from "@/lib/import/mpmb/fold";
import { resolveMpmbLimits } from "@/lib/import/mpmb/limits";
import {
  MpmbParseError,
  type MpmbParseErrorCode,
} from "@/lib/import/mpmb/types";

function expression(source: string): Expression {
  const program = parse(`(${source})`, {
    ecmaVersion: 2020,
    sourceType: "script",
    locations: true,
  });
  return (program.body[0] as ExpressionStatement).expression as Expression;
}

function fold(source: string) {
  return foldMpmbStaticExpression(
    expression(source),
    createMpmbFoldContext(resolveMpmbLimits(undefined)),
  );
}

function expectFoldCode(source: string, code: MpmbParseErrorCode) {
  try {
    fold(source);
    expect.unreachable("fold should have thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(MpmbParseError);
    expect((error as MpmbParseError).code).toBe(code);
  }
}

describe("foldMpmbStaticExpression", () => {
  it("folds the complete supported static value grammar", () => {
    const value = fold(`{
      text: "a" + "b",
      number: -2 + 5,
      bool: !false,
      nothing: null,
      template: \`static\`,
      nested: [{ value: +4 }],
      description: desc(["one", "two"]),
    }`);

    expect(value).toMatchObject({
      text: "ab",
      number: 3,
      bool: true,
      nothing: null,
      template: "static",
      nested: [{ value: 4 }],
      description: {
        type: "mpmb-helper",
        name: "desc",
        arguments: [["one", "two"]],
      },
    });
    expect(Object.getPrototypeOf(value)).toBeNull();
  });

  it("rejects identifier reads and arbitrary calls", () => {
    expectFoldCode(`AtHigherLevels`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`makeDescription(["x"])`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`desc(["x", dynamicValue])`, "UNSUPPORTED_EXPRESSION");
  });

  it("rejects functions, methods, getters, computed keys, and spreads", () => {
    expectFoldCode(`function () { return true; }`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`{ method() {} }`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`{ get value() { return 1; } }`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`{ ["dynamic"]: 1 }`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`{ ...other }`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`[1, ...other]`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`[1, , 3]`, "UNSUPPORTED_EXPRESSION");
  });

  it("rejects coercive or dynamic operators", () => {
    expectFoldCode(`"x" + 1`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`1 * 2`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`!0`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`\`value \${unknownName}\``, "UNSUPPORTED_EXPRESSION");
  });

  it("rejects regexes, bigint, duplicate keys, and prototype keys", () => {
    expectFoldCode(`/unsafe/i`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`1n`, "UNSUPPORTED_EXPRESSION");
    expectFoldCode(`{ value: 1, value: 2 }`, "DUPLICATE_PROPERTY");
    expectFoldCode(`{ constructor: 1 }`, "DANGEROUS_PROPERTY");
  });
});
