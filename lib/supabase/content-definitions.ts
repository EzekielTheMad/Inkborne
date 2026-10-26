import "server-only";

import { cache } from "react";

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
// Request-scoped only: system/type keys never share data across users or renders.
export const getContentByType = cache(async function getContentByType(
  systemId: string,
  contentType: string,
  selectableOnly = false,
): Promise<ParsedContentDefinition[]> {
  const supabase = await createClient();
  let query = supabase
    .from("content_definitions")
    .select(
      "id, name, slug, content_type, data, effects, version, source, system_id, scope, owner_id",
    )
    .eq("system_id", systemId)
    .eq("content_type", contentType);
  if (selectableOnly) query = query.eq("is_retired", false);
  const { data, error } = await query.order("name");

  if (error) throw error;

  return parseContentDefinitions(data ?? []);
});
