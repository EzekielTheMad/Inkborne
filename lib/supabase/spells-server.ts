import "server-only";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface GrantedSpell {
  spell_slug: string;
  class_slug: string;
}

export interface SpellSyncResult {
  inserted: number;
  deleted: number;
  missingSpellSlugs: string[];
}

interface ExistingFeatureSpell {
  id: string;
  class_slug: string;
  content_id: string | null;
}

function queryError(operation: string, error: { message?: string }): Error {
  return new Error(
    `[syncAlwaysPreparedSpells] ${operation} failed: ${error.message ?? "unknown database error"}`,
  );
}

/**
 * Reconciles feature-granted spells for a character using the authenticated
 * server client. Only character owners should call this mutation.
 */
export async function syncAlwaysPreparedSpells(
  supabase: ServerSupabaseClient,
  params: {
    characterId: string;
    systemId: string;
    granted: GrantedSpell[];
  },
): Promise<SpellSyncResult> {
  const { characterId, systemId, granted } = params;

  const { data: existingRows, error: existingError } = await supabase
    .from("character_spells")
    .select("id, class_slug, content_id")
    .eq("character_id", characterId)
    .eq("source", "feature");

  if (existingError) throw queryError("loading existing feature spells", existingError);

  const existing = (existingRows ?? []) as ExistingFeatureSpell[];
  const slugs = Array.from(new Set(granted.map((entry) => entry.spell_slug)));

  let spellRows: Array<{ id: string; slug: string; name: string }> = [];
  if (slugs.length > 0) {
    const { data, error } = await supabase
      .from("content_definitions")
      .select("id, slug, name")
      .eq("system_id", systemId)
      .eq("content_type", "spell")
      .eq("scope", "platform")
      .in("slug", slugs);

    if (error) throw queryError("loading granted spell definitions", error);
    spellRows = data ?? [];
  }

  const definitionBySlug = new Map(spellRows.map((row) => [row.slug, row]));
  const missingSpellSlugs = slugs.filter((slug) => !definitionBySlug.has(slug));
  const existingKeys = new Set<string>();
  const duplicateOrInvalidIds = new Set<string>();

  for (const row of existing) {
    if (!row.content_id) {
      duplicateOrInvalidIds.add(row.id);
      continue;
    }
    const key = `${row.content_id}:${row.class_slug}`;
    if (existingKeys.has(key)) duplicateOrInvalidIds.add(row.id);
    else existingKeys.add(key);
  }

  const desiredKeys = new Set<string>();
  const toInsert: Array<{
    character_id: string;
    content_id: string;
    name: string;
    class_slug: string;
    is_prepared: boolean;
    always_prepared: boolean;
    source: "feature";
  }> = [];

  for (const entry of granted) {
    const definition = definitionBySlug.get(entry.spell_slug);
    if (!definition) continue;

    const key = `${definition.id}:${entry.class_slug}`;
    if (desiredKeys.has(key)) continue;
    desiredKeys.add(key);

    if (!existingKeys.has(key)) {
      toInsert.push({
        character_id: characterId,
        content_id: definition.id,
        name: definition.name,
        class_slug: entry.class_slug,
        is_prepared: true,
        always_prepared: true,
        source: "feature",
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("character_spells").insert(toInsert);
    if (error) throw queryError("inserting feature spells", error);
  }

  const staleIds = new Set(duplicateOrInvalidIds);
  for (const row of existing) {
    if (!row.content_id) continue;
    const key = `${row.content_id}:${row.class_slug}`;
    if (!desiredKeys.has(key)) staleIds.add(row.id);
  }

  if (staleIds.size > 0) {
    const { error } = await supabase
      .from("character_spells")
      .delete()
      .in("id", Array.from(staleIds));
    if (error) throw queryError("deleting stale feature spells", error);
  }

  return {
    inserted: toInsert.length,
    deleted: staleIds.size,
    missingSpellSlugs,
  };
}
