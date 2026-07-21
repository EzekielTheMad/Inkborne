import type { FeatData } from "@/lib/schemas/content-types/feat";
import type { SourceRef } from "@/lib/schemas/content-types/mechanical";
import type { SpellData } from "@/lib/schemas/content-types/spell";
import type { Effect } from "@/lib/types/effects";

import type {
  MpmbParsedEntry,
  MpmbRegistryName,
  MpmbSourceLocation,
} from "../types";

export const MPMB_MAPPER_VERSION = "1.0.0";
export const MPMB_PARSER_COMPATIBILITY = "1.x";

export type MpmbMappingSeverity = "warning" | "blocking";

export type MpmbMappingIssueKind =
  | "missing_required"
  | "invalid_value"
  | "unmapped_field"
  | "not_automated"
  | "lossy_normalization"
  | "unknown_source"
  | "schema_violation";

export interface MpmbMappingIssue {
  code: string;
  severity: MpmbMappingSeverity;
  kind: MpmbMappingIssueKind;
  registry?: MpmbRegistryName;
  key?: string;
  path: string;
  message: string;
  location?: MpmbSourceLocation;
  /** Never more than 200 characters when supplied. */
  sourceExcerpt?: string;
}

export interface MpmbMappedSource {
  key: string;
  name: string | null;
  abbreviation: string;
  group?: string;
  url?: string;
  date?: string;
  defaultExcluded?: boolean;
  location: MpmbSourceLocation;
  issues: MpmbMappingIssue[];
}

export interface MpmbSpellCandidate {
  content_type: "spell";
  slug: string;
  name: string;
  data: SpellData;
  effects: Effect[];
}

export interface MpmbFeatCandidate {
  content_type: "feat";
  slug: string;
  name: string;
  data: FeatData;
  effects: Effect[];
}

export type MpmbMappedCandidate = MpmbSpellCandidate | MpmbFeatCandidate;
export type MpmbMappedItemStatus = "valid" | "needs_info" | "unsupported";

export interface MpmbMappedItem {
  registry: "SpellsList" | "FeatsList";
  sourceKey: string;
  contentType: "spell" | "feat";
  candidate: MpmbMappedCandidate | null;
  status: MpmbMappedItemStatus;
  sourceRefs: SourceRef[];
  location: MpmbSourceLocation;
  issues: MpmbMappingIssue[];
}

export interface MpmbMappingSummary {
  valid: number;
  needsInfo: number;
  unsupported: number;
  warnings: number;
  blockingIssues: number;
}

export interface MpmbMappingResult {
  sources: MpmbMappedSource[];
  items: MpmbMappedItem[];
  fileDiagnostics: MpmbMappingIssue[];
  summary: MpmbMappingSummary;
  parserCompatibility: typeof MPMB_PARSER_COMPATIBILITY;
  mapperVersion: typeof MPMB_MAPPER_VERSION;
}

export interface MpmbItemMappingContext {
  sourcesByKey: ReadonlyMap<string, MpmbMappedSource>;
}

export interface MpmbItemMapper {
  (entry: MpmbParsedEntry, context: MpmbItemMappingContext): MpmbMappedItem;
}
