import {
  parse,
  type CallExpression,
  type Expression,
  type Identifier,
  type Literal,
  type MemberExpression,
  type Node,
  type Program,
  type Statement,
  type VariableDeclaration,
} from "acorn";

import {
  consumeMpmbKey,
  createMpmbFoldContext,
  foldMpmbStaticExpression,
} from "./fold";
import {
  assertMpmbAstBudgets,
  getMpmbLocation,
  resolveMpmbLimits,
} from "./limits";
import {
  MPMB_REGISTRIES,
  MpmbParseError,
  type MpmbParsedEntry,
  type MpmbRegistryName,
  type MpmbSourceLocation,
  type MpmbStaticObject,
  type ParseMpmbOptions,
  type ParsedMpmbSource,
} from "./types";

const REGISTRY_SET = new Set<string>(MPMB_REGISTRIES);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function parseMpmbSource(
  source: string,
  options: ParseMpmbOptions = {},
): ParsedMpmbSource {
  if (typeof source !== "string") {
    throw new MpmbParseError("INVALID_INPUT", "MPMB source must be text");
  }

  const limits = resolveMpmbLimits(options.limits);
  const sourceBytes = new TextEncoder().encode(source).byteLength;
  if (sourceBytes > limits.maxSourceBytes) {
    throw new MpmbParseError(
      "SOURCE_TOO_LARGE",
      `Source size ${sourceBytes} bytes exceeds the limit of ${limits.maxSourceBytes}`,
    );
  }

  let tokenCount = 0;
  let program: Program;
  try {
    program = parse(source, {
      ecmaVersion: 2020,
      sourceType: "script",
      locations: true,
      allowHashBang: false,
      onToken: (token) => {
        tokenCount += 1;
        if (tokenCount > limits.maxTokens) {
          throw new MpmbParseError(
            "TOKEN_LIMIT",
            `Token count exceeds the limit of ${limits.maxTokens}`,
            getTokenLocation(token),
          );
        }
      },
    });
  } catch (error) {
    if (error instanceof MpmbParseError) throw error;
    if (error instanceof RangeError) {
      throw new MpmbParseError(
        "AST_DEPTH_LIMIT",
        "Source nesting is too deep to parse safely",
      );
    }
    if (error instanceof SyntaxError) {
      throw new MpmbParseError(
        "SYNTAX_ERROR",
        cleanAcornMessage(error.message),
        getSyntaxErrorLocation(error),
      );
    }
    throw error;
  }

  assertMpmbAstBudgets(program, limits);
  if (program.body.length > limits.maxTopLevelStatements) {
    throw new MpmbParseError(
      "STATEMENT_LIMIT",
      `Top-level statement count ${program.body.length} exceeds the limit of ${limits.maxTopLevelStatements}`,
      getMpmbLocation(program),
    );
  }

  const context = createMpmbFoldContext(limits);
  const sources: MpmbParsedEntry[] = [];
  const spells: MpmbParsedEntry[] = [];
  const feats: MpmbParsedEntry[] = [];
  const entryKeys = new Set<string>();
  let fileName: string | undefined;
  let requiredSheetVersion: string | number | undefined;
  let entryCount = 0;

  for (const statement of program.body) {
    if (statement.type === "EmptyStatement") continue;

    if (statement.type === "VariableDeclaration") {
      const parsedFileName = parseFileName(statement, context);
      if (fileName !== undefined) {
        throw new MpmbParseError(
          "DUPLICATE_METADATA",
          "iFileName may only be declared once",
          getMpmbLocation(statement),
        );
      }
      fileName = parsedFileName;
      continue;
    }

    if (statement.type !== "ExpressionStatement") {
      throw unsupportedStatement(statement);
    }

    if (statement.directive !== undefined) {
      if (statement.directive !== "use strict") {
        throw unsupportedStatement(statement);
      }
      continue;
    }

    const expression = statement.expression;
    if (expression.type === "CallExpression") {
      const parsedVersion = parseRequiredSheetVersion(expression, context);
      if (requiredSheetVersion !== undefined) {
        throw new MpmbParseError(
          "DUPLICATE_METADATA",
          "RequiredSheetVersion may only be declared once",
          getMpmbLocation(expression),
        );
      }
      requiredSheetVersion = parsedVersion;
      continue;
    }

    if (expression.type !== "AssignmentExpression") {
      throw unsupportedStatement(statement);
    }
    if (expression.operator !== "=") {
      throw new MpmbParseError(
        "UNSUPPORTED_STATEMENT",
        `Only direct registry assignment is supported, not ${expression.operator}`,
        getMpmbLocation(expression),
      );
    }
    if (expression.right.type !== "ObjectExpression") {
      throw new MpmbParseError(
        "INVALID_ENTRY",
        "Registry entries must be plain object literals",
        getMpmbLocation(expression.right),
      );
    }

    const { registry, key } = parseRegistryTarget(expression.left, context);
    if (DANGEROUS_KEYS.has(key)) {
      throw new MpmbParseError(
        "DANGEROUS_PROPERTY",
        `Dangerous registry key is not allowed: ${key}`,
        getMpmbLocation(expression.left),
      );
    }

    const identity = `${registry}\u0000${key}`;
    if (entryKeys.has(identity)) {
      throw new MpmbParseError(
        "DUPLICATE_ENTRY",
        `Duplicate ${registry} entry: ${key}`,
        getMpmbLocation(expression.left),
      );
    }
    entryKeys.add(identity);

    entryCount += 1;
    if (entryCount > limits.maxEntries) {
      throw new MpmbParseError(
        "ENTRY_LIMIT",
        `Entry count exceeds the limit of ${limits.maxEntries}`,
        getMpmbLocation(expression),
      );
    }

    const entry: MpmbParsedEntry = {
      registry,
      key,
      data: foldMpmbStaticExpression(
        expression.right,
        context,
      ) as MpmbStaticObject,
      location: getMpmbLocation(expression) ?? { line: 1, column: 1 },
    };
    getRegistryOutput(registry, sources, spells, feats).push(entry);
  }

  return {
    fileName,
    requiredSheetVersion,
    sources,
    spells,
    feats,
    limits,
  };
}

function parseFileName(
  declaration: VariableDeclaration,
  context: ReturnType<typeof createMpmbFoldContext>,
): string {
  if (
    declaration.kind !== "var" ||
    declaration.declarations.length !== 1 ||
    declaration.declarations[0]?.id.type !== "Identifier" ||
    declaration.declarations[0].id.name !== "iFileName" ||
    !declaration.declarations[0].init
  ) {
    throw new MpmbParseError(
      "INVALID_METADATA",
      "Only var iFileName = <static string> is supported",
      getMpmbLocation(declaration),
    );
  }

  const value = foldMpmbStaticExpression(
    declaration.declarations[0].init as Expression,
    context,
  );
  if (typeof value !== "string") {
    throw new MpmbParseError(
      "INVALID_METADATA",
      "iFileName must be a static string",
      getMpmbLocation(declaration),
    );
  }
  return value;
}

function parseRequiredSheetVersion(
  call: CallExpression,
  context: ReturnType<typeof createMpmbFoldContext>,
): string | number {
  if (
    call.optional ||
    call.callee.type !== "Identifier" ||
    call.callee.name !== "RequiredSheetVersion" ||
    call.arguments.length !== 1
  ) {
    throw new MpmbParseError(
      "UNSUPPORTED_STATEMENT",
      "Only RequiredSheetVersion(<static string or number>) is supported at top level",
      getMpmbLocation(call),
    );
  }

  const argument = call.arguments[0];
  if (!argument || argument.type === "SpreadElement") {
    throw new MpmbParseError(
      "INVALID_METADATA",
      "RequiredSheetVersion needs one static argument",
      getMpmbLocation(call),
    );
  }

  const value = foldMpmbStaticExpression(argument, context);
  if (typeof value !== "string" && typeof value !== "number") {
    throw new MpmbParseError(
      "INVALID_METADATA",
      "RequiredSheetVersion must be a static string or finite number",
      getMpmbLocation(call),
    );
  }
  return value;
}

function parseRegistryTarget(
  target: Node,
  context: ReturnType<typeof createMpmbFoldContext>,
): { registry: MpmbRegistryName; key: string } {
  if (target.type !== "MemberExpression") {
    throw new MpmbParseError(
      "UNSUPPORTED_REGISTRY",
      "Assignments must target a supported MPMB registry",
      getMpmbLocation(target),
    );
  }

  const member = target as MemberExpression;
  if (member.object.type !== "Identifier") {
    throw new MpmbParseError(
      "UNSUPPORTED_REGISTRY",
      "Registry targets must use a direct registry identifier",
      getMpmbLocation(member.object),
    );
  }

  const registryName = (member.object as Identifier).name;
  if (!REGISTRY_SET.has(registryName)) {
    throw new MpmbParseError(
      "UNSUPPORTED_REGISTRY",
      `Unsupported MPMB registry: ${registryName}`,
      getMpmbLocation(member.object),
    );
  }

  let key: string;
  if (!member.computed && member.property.type === "Identifier") {
    key = consumeMpmbKey(member.property.name, member.property, context);
  } else if (member.computed && member.property.type === "Literal") {
    const literal = member.property as Literal;
    if (typeof literal.value !== "string") {
      throw new MpmbParseError(
        "DYNAMIC_KEY",
        "Registry keys must be static strings",
        getMpmbLocation(member.property),
      );
    }
    key = consumeMpmbKey(literal.value, member.property, context);
  } else {
    throw new MpmbParseError(
      "DYNAMIC_KEY",
      "Registry keys must use a string literal or dot identifier",
      getMpmbLocation(member.property),
    );
  }

  return { registry: registryName as MpmbRegistryName, key };
}

function getRegistryOutput(
  registry: MpmbRegistryName,
  sources: MpmbParsedEntry[],
  spells: MpmbParsedEntry[],
  feats: MpmbParsedEntry[],
): MpmbParsedEntry[] {
  if (registry === "SourceList") return sources;
  if (registry === "SpellsList") return spells;
  return feats;
}

function unsupportedStatement(statement: Statement | Node): MpmbParseError {
  return new MpmbParseError(
    "UNSUPPORTED_STATEMENT",
    `Unsupported top-level statement: ${statement.type}`,
    getMpmbLocation(statement),
  );
}

function getSyntaxErrorLocation(error: SyntaxError): MpmbSourceLocation | undefined {
  if (!("loc" in error)) return undefined;
  const loc = error.loc;
  if (
    typeof loc !== "object" ||
    loc === null ||
    !("line" in loc) ||
    !("column" in loc) ||
    typeof loc.line !== "number" ||
    typeof loc.column !== "number"
  ) {
    return undefined;
  }
  return { line: loc.line, column: loc.column + 1 };
}

function getTokenLocation(token: {
  loc?: { start: { line: number; column: number } } | null;
}): MpmbSourceLocation | undefined {
  if (!token.loc) return undefined;
  return {
    line: token.loc.start.line,
    column: token.loc.start.column + 1,
  };
}

function cleanAcornMessage(message: string): string {
  return message.replace(/ \(\d+:\d+\)$/, "");
}
