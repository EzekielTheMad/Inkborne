import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  parseContentDefinitions,
  type ParsedContentDefinition,
} from "@/lib/supabase/content-definitions-parser";

export type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";

/**
 * Fetch and validate every definition of one type in a game system.
 *
 * Contract:
 * - a successful database request resolves to the valid parsed rows (possibly
 *   an empty array when no matching/valid rows exist);
 * - a Supabase/PostgREST failure rejects with the original structured error;
 * - malformed rows are logged and omitted individually by the pure parser.
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

  if (error) throw error;

  return parseContentDefinitions(data ?? []);
}
