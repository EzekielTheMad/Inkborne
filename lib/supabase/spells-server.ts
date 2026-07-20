import "server-only";

import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";
import type { CharacterSpell } from "@/lib/types/spells";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface SpellSyncResult {
  inserted: number;
  deleted: number;
  activeGrants: ActiveSpellGrant[];
}

export interface ActiveSpellGrant {
  content_id: string;
  content_version: number;
  class_slug: string;
}

const activeSpellGrantSchema = z.object({
  content_id: z.string().uuid(),
  content_version: z.number().int().positive(),
  class_slug: z.string().min(1),
});

const spellSyncResultSchema = z
  .array(
    z.object({
      inserted: z.number().int().nonnegative(),
      deleted: z.number().int().nonnegative(),
      active_grants: z.array(activeSpellGrantSchema),
    }),
  )
  .length(1);

function queryError(operation: string, error: { message?: string }): Error {
  return new Error(
    `[${operation}] failed: ${error.message ?? "unknown database error"}`,
  );
}

/**
 * Atomically reconciles feature-granted spell rows from the immutable grant
 * manifest captured when class/subclass controllers were pinned. The RPC
 * derives active levels from the stored character choices and never consults
 * current content definitions.
 */
export async function syncAlwaysPreparedSpells(
  supabase: ServerSupabaseClient,
  params: { characterId: string },
): Promise<SpellSyncResult> {
  const { data, error } = await supabase.rpc("sync_character_spell_grants", {
    target_character_id: params.characterId,
  });

  if (error) {
    throw queryError("syncAlwaysPreparedSpells", error);
  }

  const parsed = spellSyncResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "[syncAlwaysPreparedSpells] refusing an invalid spell-grant reconciliation result",
    );
  }

  return {
    inserted: parsed.data[0].inserted,
    deleted: parsed.data[0].deleted,
    activeGrants: parsed.data[0].active_grants,
  };
}

/** Read the same active manifest used by owner reconciliation without writing. */
export async function getActiveSpellGrants(
  supabase: ServerSupabaseClient,
  params: { characterId: string },
): Promise<ActiveSpellGrant[]> {
  const { data, error } = await supabase.rpc(
    "get_active_character_spell_grants",
    { target_character_id: params.characterId },
  );

  if (error) {
    throw queryError("getActiveSpellGrants", error);
  }

  const parsed = z.array(activeSpellGrantSchema).safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "[getActiveSpellGrants] refusing an invalid active spell-grant result",
    );
  }

  return parsed.data;
}

/**
 * Apply always-prepared state without overwriting acquisition provenance.
 * The existing character_spells uniqueness rule is logical (content + class),
 * so an explicitly selected version intentionally takes display precedence
 * over a differently-versioned pinned grant. The pinned grant supplies only
 * temporary preparation state and becomes the physical spell identity if the
 * selected acquisition is later removed while the grant remains active.
 */
export function applyActiveSpellGrantOverlays(
  spells: CharacterSpell[],
  activeGrants: ActiveSpellGrant[],
): CharacterSpell[] {
  const activeKeys = new Set(
    activeGrants.map((grant) => `${grant.content_id}:${grant.class_slug}`),
  );

  return spells.map((spell) =>
    spell.content_id &&
    activeKeys.has(`${spell.content_id}:${spell.class_slug}`)
      ? { ...spell, is_prepared: true, always_prepared: true }
      : spell,
  );
}
