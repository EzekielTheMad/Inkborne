import { featDataSchema } from "@/lib/schemas/content-types/feat";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import { effectSchema } from "@/lib/schemas/effects";

import type { ParsedMpmbSource } from "../types";
import { hasBlockingIssues, issue } from "./normalize";
import { mapMpmbFeat } from "./feats";
import { mapMpmbSpell } from "./spells";
import { createMpmbSourceIndex, mapMpmbSources } from "./sources";
import {
  MPMB_MAPPER_VERSION,
  MPMB_PARSER_COMPATIBILITY,
  type MpmbMappedItem,
  type MpmbMappingResult,
} from "./types";

export function mapParsedMpmbSource(
  parsedSource: ParsedMpmbSource,
): MpmbMappingResult {
  const sources = mapMpmbSources(parsedSource.sources);
  const sourcesByKey = createMpmbSourceIndex(sources);
  const entries = [...parsedSource.spells, ...parsedSource.feats].sort(
    (left, right) =>
      left.location.line - right.location.line ||
      left.location.column - right.location.column,
  );
  const items = entries.map((entry) =>
    finalizeMappedItem(
      entry.registry === "SpellsList"
        ? mapMpmbSpell(entry, { sourcesByKey })
        : mapMpmbFeat(entry, { sourcesByKey }),
    ),
  );

  return {
    sources,
    items,
    fileDiagnostics: [],
    summary: {
      valid: items.filter((item) => item.status === "valid").length,
      needsInfo: items.filter((item) => item.status === "needs_info").length,
      unsupported: items.filter((item) => item.status === "unsupported").length,
      warnings: countIssues(sources, items, "warning"),
      blockingIssues: countIssues(sources, items, "blocking"),
    },
    parserCompatibility: MPMB_PARSER_COMPATIBILITY,
    mapperVersion: MPMB_MAPPER_VERSION,
  };
}

export * from "./types";

function finalizeMappedItem(item: MpmbMappedItem): MpmbMappedItem {
  if (!item.candidate) return item;

  const dataResult = item.candidate.content_type === "spell"
    ? spellDataSchema.safeParse(item.candidate.data)
    : featDataSchema.safeParse(item.candidate.data);
  const issues = [...item.issues];
  if (!dataResult.success) {
    for (const schemaIssue of dataResult.error.issues) {
      issues.push(
        mappedItemIssue(
          item,
          `${item.contentType}.schema.invalid`,
          "blocking",
          "schema_violation",
          schemaIssue.path.join("."),
          schemaIssue.message,
        ),
      );
    }
  }

  for (const [index, effect] of item.candidate.effects.entries()) {
    const effectResult = effectSchema.safeParse(effect);
    if (!effectResult.success) {
      for (const schemaIssue of effectResult.error.issues) {
        issues.push(
          mappedItemIssue(
            item,
            `${item.contentType}.effect.invalid`,
            "blocking",
            "schema_violation",
            `effects.${index}.${schemaIssue.path.join(".")}`,
            schemaIssue.message,
          ),
        );
      }
    }
  }

  if (!dataResult.success) {
    return { ...item, candidate: null, status: "needs_info", issues };
  }
  return {
    ...item,
    status: hasBlockingIssues(issues) ? "needs_info" : "valid",
    issues,
  };
}

function mappedItemIssue(
  item: MpmbMappedItem,
  code: string,
  severity: "warning" | "blocking",
  kind: Parameters<typeof issue>[3],
  path: string,
  message: string,
) {
  return {
    ...issue(undefined, code, severity, kind, path, message),
    registry: item.registry,
    key: item.sourceKey,
    location: item.location,
  };
}

function countIssues(
  sources: MpmbMappingResult["sources"],
  items: MpmbMappedItem[],
  severity: "warning" | "blocking",
): number {
  return [...sources.flatMap((source) => source.issues), ...items.flatMap((item) => item.issues)]
    .filter((entry) => entry.severity === severity).length;
}
