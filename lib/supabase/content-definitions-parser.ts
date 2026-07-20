import { z } from "zod";

import { contentDefinitionSchema } from "@/lib/schemas/content";
import { parseContentByType } from "@/lib/schemas/content-types";
import type { Effect } from "@/lib/types/effects";

/**
 * A content definition whose database envelope and type-specific payload have
 * both passed runtime validation.
 *
 * This type and the parsers below intentionally live in a module with no
 * Supabase or Next.js imports. They are safe to use from scripts, tests, and
 * client/runtime-neutral code without pulling `next/headers` into the bundle.
 */
export interface ParsedContentDefinition<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  version: number;
  source: "srd" | "homebrew";
  version_created_at?: string;
  data: TData;
  effects: Effect[];
}

const contentDefinitionIdSchema = z.string().uuid();

const contentVersionSnapshotSchema = z.object({
  content_id: z.string().uuid(),
  version: z.number().int().positive(),
  system_id_snapshot: z.string().uuid(),
  content_type_snapshot: z.string().min(1),
  slug_snapshot: z.string().min(1),
  name_snapshot: z.string().min(1),
  data_snapshot: z.record(z.string(), z.unknown()),
  effects_snapshot: z.unknown(),
  source_snapshot: z.enum(["srd", "homebrew"]),
  scope_snapshot: z.enum(["platform", "personal", "shared"]),
  owner_id_snapshot: z.string().uuid().nullable(),
  created_at: z.string().datetime({ offset: true }).optional(),
});

/**
 * Parse one raw `content_definitions` row.
 *
 * Malformed rows are logged with an identifying slug when available and
 * return `null`, allowing callers to omit only that row. Database/query errors
 * are deliberately not represented here; server fetchers preserve those via
 * their rejected promise channel.
 */
export function parseContentDefinition(
  raw: unknown,
): ParsedContentDefinition | null {
  const envelope = contentDefinitionSchema.safeParse(raw);
  const id = contentDefinitionIdSchema.safeParse(
    (raw as { id?: unknown } | null)?.id,
  );

  if (!envelope.success || !id.success) {
    const maybeSlug = (raw as { slug?: unknown } | null)?.slug;
    console.error(
      `[content-definitions] Bad envelope for ${typeof maybeSlug === "string" ? maybeSlug : "<unknown>"}:`,
      [
        ...(envelope.success ? [] : envelope.error.issues),
        ...(id.success ? [] : id.error.issues),
      ],
    );
    return null;
  }

  const inner = parseContentByType(
    envelope.data.content_type,
    envelope.data.data,
  );
  if (!inner.ok) {
    if (inner.error === "unknown_content_type") {
      console.error(
        `[content-definitions] Unknown content_type for ${envelope.data.slug}:`,
        envelope.data.content_type,
      );
    } else {
      console.error(
        `[content-definitions] Bad data for ${envelope.data.slug} (${envelope.data.content_type}):`,
        inner.issues,
      );
    }
    return null;
  }

  return {
    id: id.data,
    name: envelope.data.name,
    slug: envelope.data.slug,
    content_type: envelope.data.content_type,
    version: envelope.data.version,
    source: envelope.data.source,
    data: inner.data as Record<string, unknown>,
    effects: envelope.data.effects,
  };
}

/** Parse a collection while omitting only malformed rows. */
export function parseContentDefinitions(
  rows: readonly unknown[],
): ParsedContentDefinition[] {
  const parsed: ParsedContentDefinition[] = [];
  for (const row of rows) {
    const definition = parseContentDefinition(row);
    if (definition !== null) parsed.push(definition);
  }
  return parsed;
}

/**
 * Parse a `content_definitions` value embedded by a PostgREST relationship.
 *
 * To-one joins normally arrive as an object or `null`, but some generated
 * query types model the same relationship as a single-element array. An
 * absent join remains `null`; malformed definitions are reported by the
 * canonical parser and also become `null` so callers can retain custom parent
 * rows without trusting invalid definition data.
 */
export function parseNestedContentDefinition(
  raw: unknown,
): ParsedContentDefinition | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    if (raw.length !== 1) {
      console.error(
        `[content-definitions] Expected one joined definition, received ${raw.length}`,
      );
      return null;
    }
    return parseContentDefinition(raw[0]);
  }

  return parseContentDefinition(raw);
}

/**
 * Parse one immutable `content_versions` snapshot into the same trusted shape
 * used for current catalog definitions. Character-bound reads use this path so
 * a later homebrew or platform update cannot silently change an existing
 * character.
 */
export function parseContentVersionSnapshot(
  raw: unknown,
): ParsedContentDefinition | null {
  const snapshot = contentVersionSnapshotSchema.safeParse(raw);
  if (!snapshot.success) {
    const maybeContentId = (raw as { content_id?: unknown } | null)?.content_id;
    console.error(
      `[content-versions] Bad snapshot for ${typeof maybeContentId === "string" ? maybeContentId : "<unknown>"}:`,
      snapshot.error.issues,
    );
    return null;
  }

  return parseContentDefinition({
    id: snapshot.data.content_id,
    system_id: snapshot.data.system_id_snapshot,
    content_type: snapshot.data.content_type_snapshot,
    slug: snapshot.data.slug_snapshot,
    name: snapshot.data.name_snapshot,
    data: snapshot.data.data_snapshot,
    effects: snapshot.data.effects_snapshot,
    source: snapshot.data.source_snapshot,
    scope: snapshot.data.scope_snapshot,
    owner_id: snapshot.data.owner_id_snapshot,
    version: snapshot.data.version,
    version_created_at: snapshot.data.created_at,
  });
}

/** Parse a PostgREST to-one snapshot relationship. */
export function parseNestedContentVersionSnapshot(
  raw: unknown,
): ParsedContentDefinition | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    if (raw.length !== 1) {
      console.error(
        `[content-versions] Expected one joined snapshot, received ${raw.length}`,
      );
      return null;
    }
    return parseContentVersionSnapshot(raw[0]);
  }

  return parseContentVersionSnapshot(raw);
}
