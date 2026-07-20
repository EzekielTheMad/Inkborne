import type {
  ArrayExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  Literal,
  Node,
  ObjectExpression,
  Property,
  TemplateLiteral,
  UnaryExpression,
} from "acorn";

import {
  MpmbParseError,
  type MpmbParserLimits,
  type MpmbStaticHelperCall,
  type MpmbStaticObject,
  type MpmbStaticValue,
} from "./types";
import { getMpmbLocation } from "./limits";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export interface MpmbFoldContext {
  readonly limits: Readonly<MpmbParserLimits>;
  totalStringLength: number;
}

export function createMpmbFoldContext(
  limits: Readonly<MpmbParserLimits>,
): MpmbFoldContext {
  return { limits, totalStringLength: 0 };
}

export function consumeMpmbString(
  value: string,
  node: Node,
  context: MpmbFoldContext,
): string {
  assertMpmbStringLength(value, node, context);

  context.totalStringLength += value.length;
  if (context.totalStringLength > context.limits.maxTotalStringLength) {
    throw new MpmbParseError(
      "TOTAL_STRING_LENGTH_LIMIT",
      `Aggregate string length exceeds the limit of ${context.limits.maxTotalStringLength}`,
      getMpmbLocation(node),
    );
  }

  return value;
}

export function consumeMpmbKey(
  value: string,
  node: Node,
  context: MpmbFoldContext,
): string {
  if (value.length > context.limits.maxKeyLength) {
    throw new MpmbParseError(
      "KEY_LENGTH_LIMIT",
      `Key length ${value.length} exceeds the limit of ${context.limits.maxKeyLength}`,
      getMpmbLocation(node),
    );
  }
  return consumeMpmbString(value, node, context);
}

export function foldMpmbStaticExpression(
  expression: Expression | Literal,
  context: MpmbFoldContext,
  depth = 1,
): MpmbStaticValue {
  if (depth > context.limits.maxAstDepth) {
    throw new MpmbParseError(
      "AST_DEPTH_LIMIT",
      `Static value depth exceeds the limit of ${context.limits.maxAstDepth}`,
      getMpmbLocation(expression),
    );
  }

  switch (expression.type) {
    case "Literal":
      return foldLiteral(expression, context);
    case "ArrayExpression":
      return foldArray(expression, context, depth);
    case "ObjectExpression":
      return foldObject(expression, context, depth);
    case "UnaryExpression":
      return foldUnary(expression, context, depth);
    case "BinaryExpression":
      return foldBinary(expression, context, depth);
    case "TemplateLiteral":
      return foldTemplate(expression, context);
    case "CallExpression":
      return foldAllowlistedCall(expression, context, depth);
    default:
      throw new MpmbParseError(
        "UNSUPPORTED_EXPRESSION",
        `Unsupported static expression: ${expression.type}`,
        getMpmbLocation(expression),
      );
  }
}

function foldLiteral(
  literal: Literal,
  context: MpmbFoldContext,
): MpmbStaticValue {
  const value = literal.value;
  if (typeof value === "string") {
    return consumeMpmbString(value, literal, context);
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new MpmbParseError(
        "NON_FINITE_NUMBER",
        "Numeric values must be finite",
        getMpmbLocation(literal),
      );
    }
    return value;
  }

  throw new MpmbParseError(
    "UNSUPPORTED_EXPRESSION",
    "Regular expressions and bigint literals are not supported",
    getMpmbLocation(literal),
  );
}

function foldArray(
  array: ArrayExpression,
  context: MpmbFoldContext,
  depth: number,
): MpmbStaticValue[] {
  if (array.elements.length > context.limits.maxArrayElements) {
    throw new MpmbParseError(
      "ARRAY_ELEMENT_LIMIT",
      `Array length ${array.elements.length} exceeds the limit of ${context.limits.maxArrayElements}`,
      getMpmbLocation(array),
    );
  }

  return array.elements.map((element) => {
    if (!element || element.type === "SpreadElement") {
      throw new MpmbParseError(
        "UNSUPPORTED_EXPRESSION",
        "Sparse arrays and spread elements are not supported",
        getMpmbLocation(element ?? array),
      );
    }
    return foldMpmbStaticExpression(element, context, depth + 1);
  });
}

function foldObject(
  object: ObjectExpression,
  context: MpmbFoldContext,
  depth: number,
): MpmbStaticObject {
  if (object.properties.length > context.limits.maxObjectProperties) {
    throw new MpmbParseError(
      "OBJECT_PROPERTY_LIMIT",
      `Object property count ${object.properties.length} exceeds the limit of ${context.limits.maxObjectProperties}`,
      getMpmbLocation(object),
    );
  }

  const output = Object.create(null) as MpmbStaticObject;
  const keys = new Set<string>();

  for (const propertyNode of object.properties) {
    if (propertyNode.type === "SpreadElement") {
      throw new MpmbParseError(
        "UNSUPPORTED_EXPRESSION",
        "Object spread is not supported",
        getMpmbLocation(propertyNode),
      );
    }

    const property = propertyNode as Property;
    if (
      property.kind !== "init" ||
      property.method ||
      property.computed ||
      property.shorthand
    ) {
      throw new MpmbParseError(
        "UNSUPPORTED_EXPRESSION",
        "Only explicit, non-computed data properties are supported",
        getMpmbLocation(property),
      );
    }

    const key = readObjectKey(property, context);
    if (DANGEROUS_KEYS.has(key)) {
      throw new MpmbParseError(
        "DANGEROUS_PROPERTY",
        `Dangerous object key is not allowed: ${key}`,
        getMpmbLocation(property.key),
      );
    }
    if (keys.has(key)) {
      throw new MpmbParseError(
        "DUPLICATE_PROPERTY",
        `Duplicate object property: ${key}`,
        getMpmbLocation(property.key),
      );
    }
    keys.add(key);

    output[key] = foldMpmbStaticExpression(
      property.value as Expression,
      context,
      depth + 1,
    );
  }

  return output;
}

function readObjectKey(
  property: Property,
  context: MpmbFoldContext,
): string {
  if (property.key.type === "Identifier") {
    return consumeMpmbKey(property.key.name, property.key, context);
  }
  if (property.key.type === "Literal") {
    const value = property.key.value;
    if (typeof value === "string" || typeof value === "number") {
      return consumeMpmbKey(String(value), property.key, context);
    }
  }

  throw new MpmbParseError(
    "DYNAMIC_KEY",
    "Object keys must be static identifiers, strings, or numbers",
    getMpmbLocation(property.key),
  );
}

function foldUnary(
  unary: UnaryExpression,
  context: MpmbFoldContext,
  depth: number,
): MpmbStaticValue {
  const argument = foldMpmbStaticExpression(unary.argument, context, depth + 1);

  if (unary.operator === "!") {
    if (typeof argument !== "boolean") {
      throw new MpmbParseError(
        "UNSUPPORTED_EXPRESSION",
        "Unary ! requires a boolean literal",
        getMpmbLocation(unary),
      );
    }
    return !argument;
  }
  if (unary.operator === "+" || unary.operator === "-") {
    if (typeof argument !== "number") {
      throw new MpmbParseError(
        "UNSUPPORTED_EXPRESSION",
        `Unary ${unary.operator} requires a numeric literal`,
        getMpmbLocation(unary),
      );
    }
    const value = unary.operator === "+" ? argument : -argument;
    if (!Number.isFinite(value)) {
      throw new MpmbParseError(
        "NON_FINITE_NUMBER",
        "Numeric values must be finite",
        getMpmbLocation(unary),
      );
    }
    return value;
  }

  throw new MpmbParseError(
    "UNSUPPORTED_EXPRESSION",
    `Unsupported unary operator: ${unary.operator}`,
    getMpmbLocation(unary),
  );
}

function foldBinary(
  binary: BinaryExpression,
  context: MpmbFoldContext,
  depth: number,
): MpmbStaticValue {
  if (binary.operator !== "+") {
    throw new MpmbParseError(
      "UNSUPPORTED_EXPRESSION",
      `Unsupported binary operator: ${binary.operator}`,
      getMpmbLocation(binary),
    );
  }

  const left = foldMpmbStaticExpression(
    binary.left as Expression,
    context,
    depth + 1,
  );
  const right = foldMpmbStaticExpression(binary.right, context, depth + 1);

  if (typeof left === "string" && typeof right === "string") {
    const value = left + right;
    assertMpmbStringLength(value, binary, context);
    return value;
  }
  if (typeof left === "number" && typeof right === "number") {
    const value = left + right;
    if (!Number.isFinite(value)) {
      throw new MpmbParseError(
        "NON_FINITE_NUMBER",
        "Numeric values must be finite",
        getMpmbLocation(binary),
      );
    }
    return value;
  }

  throw new MpmbParseError(
    "UNSUPPORTED_EXPRESSION",
    "Static + expressions must combine two strings or two numbers",
    getMpmbLocation(binary),
  );
}

function foldTemplate(
  template: TemplateLiteral,
  context: MpmbFoldContext,
): string {
  if (template.expressions.length > 0 || template.quasis.length !== 1) {
    throw new MpmbParseError(
      "UNSUPPORTED_EXPRESSION",
      "Template interpolation is not supported",
      getMpmbLocation(template),
    );
  }

  const value = template.quasis[0]?.value.cooked;
  if (value === null || value === undefined) {
    throw new MpmbParseError(
      "UNSUPPORTED_EXPRESSION",
      "Invalid template literal",
      getMpmbLocation(template),
    );
  }
  return consumeMpmbString(value, template, context);
}

function foldAllowlistedCall(
  call: CallExpression,
  context: MpmbFoldContext,
  depth: number,
): MpmbStaticHelperCall {
  if (
    call.optional ||
    call.callee.type !== "Identifier" ||
    call.callee.name !== "desc" ||
    call.arguments.length !== 1
  ) {
    throw new MpmbParseError(
      "UNSUPPORTED_EXPRESSION",
      "Only the static desc([...]) helper is supported inside data",
      getMpmbLocation(call),
    );
  }

  const argument = call.arguments[0];
  if (!argument || argument.type === "SpreadElement") {
    throw new MpmbParseError(
      "UNSUPPORTED_EXPRESSION",
      "desc requires one static array argument",
      getMpmbLocation(call),
    );
  }

  const value = foldMpmbStaticExpression(argument, context, depth + 1);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new MpmbParseError(
      "UNSUPPORTED_EXPRESSION",
      "desc requires an array containing only static strings",
      getMpmbLocation(call),
    );
  }

  return {
    type: "mpmb-helper",
    name: "desc",
    arguments: [value],
  };
}

function assertMpmbStringLength(
  value: string,
  node: Node,
  context: MpmbFoldContext,
): void {
  if (value.length > context.limits.maxStringLength) {
    throw new MpmbParseError(
      "STRING_LENGTH_LIMIT",
      `String length ${value.length} exceeds the limit of ${context.limits.maxStringLength}`,
      getMpmbLocation(node),
    );
  }
}
