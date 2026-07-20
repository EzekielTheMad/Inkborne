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
  data: TData;
  effects: Effect[];
}

const contentDefinitionIdSchema = z.string().uuid();

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
