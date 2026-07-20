export const MPMB_REGISTRIES = [
  "SourceList",
  "SpellsList",
  "FeatsList",
] as const;

export type MpmbRegistryName = (typeof MPMB_REGISTRIES)[number];

export interface MpmbSourceLocation {
  /** One-based line number. */
  line: number;
  /** One-based column number. */
  column: number;
}

export type MpmbStaticPrimitive = string | number | boolean | null;

export interface MpmbStaticObject {
  [key: string]: MpmbStaticValue;
}

export interface MpmbStaticHelperCall {
  type: "mpmb-helper";
  name: "desc";
  arguments: MpmbStaticValue[];
}

export type MpmbStaticValue =
  | MpmbStaticPrimitive
  | MpmbStaticValue[]
  | MpmbStaticObject
  | MpmbStaticHelperCall;

export interface MpmbParsedEntry {
  registry: MpmbRegistryName;
  key: string;
  data: MpmbStaticObject;
  location: MpmbSourceLocation;
}

export interface MpmbParserLimits {
  maxSourceBytes: number;
  maxTokens: number;
  maxAstNodes: number;
  maxAstDepth: number;
  maxTopLevelStatements: number;
  maxEntries: number;
  maxObjectProperties: number;
  maxArrayElements: number;
  maxKeyLength: number;
  maxStringLength: number;
  maxTotalStringLength: number;
}

export const DEFAULT_MPMB_PARSER_LIMITS = Object.freeze({
  maxSourceBytes: 2_097_152,
  maxTokens: 100_000,
  maxAstNodes: 100_000,
  maxAstDepth: 32,
  maxTopLevelStatements: 2_048,
  maxEntries: 1_000,
  maxObjectProperties: 256,
  maxArrayElements: 256,
  maxKeyLength: 256,
  maxStringLength: 262_144,
  maxTotalStringLength: 2_097_152,
}) satisfies Readonly<MpmbParserLimits>;

export interface ParseMpmbOptions {
  /**
   * Callers may lower hard ceilings for a particular boundary or test. Raising
   * a ceiling is rejected so an upload path cannot accidentally disable a
   * parser safety invariant.
   */
  limits?: Partial<MpmbParserLimits>;
}

export interface ParsedMpmbSource {
  fileName?: string;
  requiredSheetVersion?: string | number;
  sources: MpmbParsedEntry[];
  spells: MpmbParsedEntry[];
  feats: MpmbParsedEntry[];
  limits: Readonly<MpmbParserLimits>;
}

export type MpmbParseErrorCode =
  | "INVALID_INPUT"
  | "INVALID_LIMITS"
  | "SOURCE_TOO_LARGE"
  | "TOKEN_LIMIT"
  | "SYNTAX_ERROR"
  | "AST_NODE_LIMIT"
  | "AST_DEPTH_LIMIT"
  | "STATEMENT_LIMIT"
  | "ENTRY_LIMIT"
  | "OBJECT_PROPERTY_LIMIT"
  | "ARRAY_ELEMENT_LIMIT"
  | "KEY_LENGTH_LIMIT"
  | "STRING_LENGTH_LIMIT"
  | "TOTAL_STRING_LENGTH_LIMIT"
  | "UNSUPPORTED_STATEMENT"
  | "UNSUPPORTED_EXPRESSION"
  | "UNSUPPORTED_REGISTRY"
  | "DYNAMIC_KEY"
  | "DUPLICATE_ENTRY"
  | "DUPLICATE_PROPERTY"
  | "DANGEROUS_PROPERTY"
  | "INVALID_ENTRY"
  | "INVALID_METADATA"
  | "DUPLICATE_METADATA"
  | "NON_FINITE_NUMBER";

export class MpmbParseError extends Error {
  readonly code: MpmbParseErrorCode;
  readonly location?: MpmbSourceLocation;

  constructor(
    code: MpmbParseErrorCode,
    message: string,
    location?: MpmbSourceLocation,
  ) {
    const locationSuffix = location
      ? ` (line ${location.line}, column ${location.column})`
      : "";
    super(`${message}${locationSuffix}`);
    this.name = "MpmbParseError";
    this.code = code;
    this.location = location;
  }
}
