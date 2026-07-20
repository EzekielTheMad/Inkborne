import type { MpmbParsedEntry, MpmbStaticValue } from "../types";
import type {
  MpmbMappingIssue,
  MpmbMappingIssueKind,
  MpmbMappingSeverity,
} from "./types";

const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

const ABILITY_ALIASES = new Map<string, string>([
  ["str", "strength"],
  ["strength", "strength"],
  ["dex", "dexterity"],
  ["dexterity", "dexterity"],
  ["con", "constitution"],
  ["constitution", "constitution"],
  ["int", "intelligence"],
  ["intelligence", "intelligence"],
  ["wis", "wisdom"],
  ["wisdom", "wisdom"],
  ["cha", "charisma"],
  ["charisma", "charisma"],
]);

export const ABILITY_NAMES = ABILITIES;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeStringList(value: unknown): string[] | null {
  const input = typeof value === "string" ? [value] : value;
  if (!Array.isArray(input) || input.some((item) => typeof item !== "string")) {
    return null;
  }
  return [...new Set(input.map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

export function normalizeAbility(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6) {
    return ABILITIES[value - 1] ?? null;
  }
  if (typeof value !== "string") return null;
  return ABILITY_ALIASES.get(value.trim().toLowerCase()) ?? null;
}

export function readStaticText(value: MpmbStaticValue | undefined): string | null {
  if (typeof value === "string") return normalizeString(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    const text = value.map((item) => item.trim()).filter(Boolean).join("\n");
    return text.length > 0 ? text : null;
  }
  if (
    isRecord(value) &&
    value.type === "mpmb-helper" &&
    value.name === "desc" &&
    Array.isArray(value.arguments) &&
    value.arguments.length === 1 &&
    Array.isArray(value.arguments[0]) &&
    value.arguments[0].every((item) => typeof item === "string")
  ) {
    const text = value.arguments[0]
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n");
    return text.length > 0 ? text : null;
  }
  return null;
}

export function issue(
  entry: MpmbParsedEntry | undefined,
  code: string,
  severity: MpmbMappingSeverity,
  kind: MpmbMappingIssueKind,
  path: string,
  message: string,
): MpmbMappingIssue {
  return {
    code,
    severity,
    kind,
    registry: entry?.registry,
    key: entry?.key,
    path,
    message,
    location: entry?.location,
  };
}

export function reportUnknownFields(
  entry: MpmbParsedEntry,
  knownFields: ReadonlySet<string>,
  issues: MpmbMappingIssue[],
): void {
  for (const key of Object.keys(entry.data).sort()) {
    if (!knownFields.has(key)) {
      issues.push(
        issue(
          entry,
          `unmapped.${key}`,
          "warning",
          "unmapped_field",
          key,
          `MPMB field ${key} is retained only as an unmapped diagnostic`,
        ),
      );
    }
  }
}

export function hasBlockingIssues(issues: readonly MpmbMappingIssue[]): boolean {
  return issues.some((entry) => entry.severity === "blocking");
}
