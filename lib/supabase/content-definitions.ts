import { createClient } from "@/lib/supabase/server";
import { contentDefinitionSchema } from "@/lib/schemas/content";
import { parseContentByType } from "@/lib/schemas/content-types";
import type { Effect } from "@/lib/types/effects";

/**
 * Result of parsing a single content_definitions row. The outer envelope
 * (slug, name, content_type, effects, version, source) has been validated
 * by contentDefinitionSchema; the inner `data` has been validated by the
 * content-type-specific schema looked up via parseContentByType(content_type).
 *
 * Generic over TData so callers that asked for a specific content_type (e.g.
 * "class") can cast the inner data to the corresponding type (ClassData) —
 * the cast is safe because parsing has already succeeded.
 */
export interface ParsedContentDefinition<TData = unknown> {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  version: number;
  source: "srd" | "homebrew";
  data: TData;
  effects: Effect[];
}

/**
 * Parse a single raw row (e.g. from a JOIN result like content_refs). Returns
 * null on any of three failure modes:
 *  - the envelope (contentDefinitionSchema) rejects the row;
 *  - the row's content_type has no registered schema;
 *  - the inner data fails the content-type schema.
 *
 * Each failure logs to console.error with the slug + issues so the source row
 * is identifiable when debugging.
 */
export function parseContentDefinition(
  raw: unknown,
): ParsedContentDefinition | null {
  // Stage 1: envelope.
  const envelope = contentDefinitionSchema.safeParse(raw);
  if (!envelope.success) {
    const maybeSlug = (raw as { slug?: unknown })?.slug;
    console.error(
      `[content-definitions] Bad envelope for ${typeof maybeSlug === "string" ? maybeSlug : "<unknown>"}:`,
      envelope.error.issues,
    );
    return null;
  }

  // Stage 2: inner data via the content-type schema.
  const inner = parseContentByType(envelope.data.content_type, envelope.data.data);
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

  // contentDefinitionSchema's shape omits `id`, but the column always exists on
  // fetched rows — read it directly from raw. `version` IS in the schema (with
  // a default), so prefer the validated envelope value.
  return {
    id: (raw as { id: string }).id,
    name: envelope.data.name,
    slug: envelope.data.slug,
    content_type: envelope.data.content_type,
    version: envelope.data.version,
    source: envelope.data.source,
    data: inner.data,
    effects: envelope.data.effects,
  };
}

/**
 * Server-side: fetch all content_definitions of one content_type for one
 * system, parse each row, drop bad rows. Returns the parsed array.
 *
 * Errors logged to console.error with the slug + issues. Caller never sees
 * the failures — just gets a smaller array.
 */
export async function getContentByType(
  systemId: string,
  contentType: string,
): Promise<ParsedContentDefinition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_definitions")
    .select(
      "id, name, slug, content_type, data, effects, version, source, system_id, scope, owner_id",
    )
    .eq("system_id", systemId)
    .eq("content_type", contentType)
    .order("name");

  if (error) {
    console.error(
      `[content-definitions] Supabase error fetching ${contentType}:`,
      error.message,
    );
    return [];
  }

  const parsed: ParsedContentDefinition[] = [];
  for (const row of data ?? []) {
    const result = parseContentDefinition(row);
    if (result !== null) parsed.push(result);
  }
  return parsed;
}
