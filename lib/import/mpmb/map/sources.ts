import type { SourceRef } from "@/lib/schemas/content-types/mechanical";

import type { MpmbParsedEntry, MpmbStaticValue } from "../types";
import {
  issue,
  normalizeString,
  reportUnknownFields,
} from "./normalize";
import type { MpmbMappedSource, MpmbMappingIssue } from "./types";

const SOURCE_FIELDS = new Set([
  "name",
  "abbreviation",
  "group",
  "url",
  "date",
  "defaultExcluded",
]);

export function mapMpmbSources(entries: readonly MpmbParsedEntry[]): MpmbMappedSource[] {
  return entries.map((entry) => {
    const issues: MpmbMappingIssue[] = [];
    const name = normalizeString(entry.data.name);
    if (!name) {
      issues.push(
        issue(
          entry,
          "source.name.required",
          "blocking",
          "missing_required",
          "name",
          "SourceList entries need a non-empty name for import provenance",
        ),
      );
    }

    const abbreviation = normalizeString(entry.data.abbreviation) ?? entry.key;
    const group = optionalString(entry, "group", issues);
    const url = optionalString(entry, "url", issues);
    const date = optionalString(entry, "date", issues);
    const defaultExcluded = optionalBoolean(
      entry,
      "defaultExcluded",
      issues,
    );
    reportUnknownFields(entry, SOURCE_FIELDS, issues);

    return {
      key: entry.key,
      name,
      abbreviation,
      ...(group ? { group } : {}),
      ...(url ? { url } : {}),
      ...(date ? { date } : {}),
      ...(defaultExcluded === undefined ? {} : { defaultExcluded }),
      location: entry.location,
      issues,
    };
  });
}

export function createMpmbSourceIndex(
  sources: readonly MpmbMappedSource[],
): ReadonlyMap<string, MpmbMappedSource> {
  return new Map(sources.map((source) => [source.key, source]));
}

export function resolveMpmbSourceRefs(
  entry: MpmbParsedEntry,
  value: MpmbStaticValue | undefined,
  sourcesByKey: ReadonlyMap<string, MpmbMappedSource>,
): { refs: SourceRef[]; issues: MpmbMappingIssue[] } {
  const issues: MpmbMappingIssue[] = [];
  if (value === undefined) {
    issues.push(
      issue(
        entry,
        "source.required",
        "blocking",
        "missing_required",
        "source",
        "Imported content needs an explicit MPMB source reference",
      ),
    );
    return { refs: [], issues };
  }

  const tuples = isSourceTuple(value) ? [value] : value;
  if (!Array.isArray(tuples) || !tuples.every(isSourceTuple)) {
    issues.push(
      issue(
        entry,
        "source.invalid_shape",
        "blocking",
        "invalid_value",
        "source",
        "Source must be [code, page] or an array of [code, page] tuples",
      ),
    );
    return { refs: [], issues };
  }

  const refs: SourceRef[] = [];
  const identities = new Set<string>();
  for (const tuple of tuples) {
    const code = tuple[0].trim();
    const page = tuple[1];
    const identity = `${code}\u0000${page}`;
    if (identities.has(identity)) continue;
    identities.add(identity);
    refs.push({ book: code, page });

    if (!sourcesByKey.has(code)) {
      issues.push(
        issue(
          entry,
          `source.unknown.${code}`,
          "warning",
          "unknown_source",
          "source",
          `Source code ${code} is not declared in this file; it may refer to an existing platform source`,
        ),
      );
    }
  }

  return { refs, issues };
}

function optionalString(
  entry: MpmbParsedEntry,
  key: string,
  issues: MpmbMappingIssue[],
): string | undefined {
  const value = entry.data[key];
  if (value === undefined) return undefined;
  const normalized = normalizeString(value);
  if (normalized) return normalized;
  issues.push(
    issue(
      entry,
      `source.${key}.invalid`,
      "warning",
      "invalid_value",
      key,
      `Source ${key} must be a non-empty string when supplied`,
    ),
  );
  return undefined;
}

function optionalBoolean(
  entry: MpmbParsedEntry,
  key: string,
  issues: MpmbMappingIssue[],
): boolean | undefined {
  const value = entry.data[key];
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  issues.push(
    issue(
      entry,
      `source.${key}.invalid`,
      "warning",
      "invalid_value",
      key,
      `Source ${key} must be a boolean when supplied`,
    ),
  );
  return undefined;
}

function isSourceTuple(value: unknown): value is [string, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    value[0].trim().length > 0 &&
    typeof value[1] === "number" &&
    Number.isInteger(value[1]) &&
    value[1] >= 0
  );
}
