import type { Node } from "acorn";

import {
  DEFAULT_MPMB_PARSER_LIMITS,
  MpmbParseError,
  type MpmbParserLimits,
  type MpmbSourceLocation,
} from "./types";

export function resolveMpmbLimits(
  overrides: Partial<MpmbParserLimits> | undefined,
): Readonly<MpmbParserLimits> {
  const limits: MpmbParserLimits = { ...DEFAULT_MPMB_PARSER_LIMITS };

  if (!overrides) return Object.freeze(limits);

  for (const key of Object.keys(overrides) as Array<keyof MpmbParserLimits>) {
    const value = overrides[key];
    if (
      value === undefined ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > DEFAULT_MPMB_PARSER_LIMITS[key]
    ) {
      throw new MpmbParseError(
        "INVALID_LIMITS",
        `${key} must be a positive integer no greater than the hard ceiling of ${DEFAULT_MPMB_PARSER_LIMITS[key]}`,
      );
    }
    limits[key] = value;
  }

  return Object.freeze(limits);
}

export function getMpmbLocation(node: Node): MpmbSourceLocation | undefined {
  if (!node.loc) return undefined;
  return {
    line: node.loc.start.line,
    column: node.loc.start.column + 1,
  };
}

export function assertMpmbAstBudgets(
  root: Node,
  limits: Readonly<MpmbParserLimits>,
): void {
  const stack: Array<{ node: Node; depth: number }> = [{ node: root, depth: 1 }];
  const seen = new Set<Node>();
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current.node)) continue;
    seen.add(current.node);

    count += 1;
    if (count > limits.maxAstNodes) {
      throw new MpmbParseError(
        "AST_NODE_LIMIT",
        `AST node count exceeds the limit of ${limits.maxAstNodes}`,
        getMpmbLocation(current.node),
      );
    }
    if (current.depth > limits.maxAstDepth) {
      throw new MpmbParseError(
        "AST_DEPTH_LIMIT",
        `AST depth exceeds the limit of ${limits.maxAstDepth}`,
        getMpmbLocation(current.node),
      );
    }

    for (const value of Object.values(current.node)) {
      if (isNode(value)) {
        stack.push({ node: value, depth: current.depth + 1 });
      } else if (Array.isArray(value)) {
        for (const child of value) {
          if (isNode(child)) {
            stack.push({ node: child, depth: current.depth + 1 });
          }
        }
      }
    }
  }
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "start" in value &&
    "end" in value
  );
}
