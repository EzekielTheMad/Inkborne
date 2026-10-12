import "server-only";

import { cache } from "react";
import { z } from "zod";

import {
  parseNestedContentVersionSnapshot,
  type ParsedContentDefinition,
} from "@/lib/supabase/content-definitions-parser";
import { createClient } from "@/lib/supabase/server";
import type { CharacterContentRef } from "@/lib/types/character";
import { frozenFeatureGrantSchema, type AsiEvidence } from "@/lib/character/asi-contributions";

export interface ContentRefWithContent extends CharacterContentRef {
  content_definitions: ParsedContentDefinition;
}

const contentRefEnvelopeSchema = z.object({
  feature_grant_id: z.uuid().nullable(),
  id: z.string().uuid(),
  character_id: z.string().uuid(),
  content_id: z.string().uuid(),
  content_version: z.number().int().positive(),
  context: z.record(z.string(), z.unknown()),
  choice_source: z.string().nullable(),
  created_at: z.string().min(1),
  content_versions: z.unknown(),
});

/** Parse one joined content ref, returning null only for that malformed row. */
export function parseContentRefWithContent(
  raw: unknown,
): ContentRefWithContent | null {
  const envelope = contentRefEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    const maybeId = (raw as { id?: unknown } | null)?.id;
    console.error(
      `[content-refs] Bad envelope for ${typeof maybeId === "string" ? maybeId : "<unknown>"}:`,
      envelope.error.issues,
    );
    return null;
  }

  const definition = parseNestedContentVersionSnapshot(
    envelope.data.content_versions,
  );
  if (definition === null) return null;

  return {
    feature_grant_id: envelope.data.feature_grant_id,
    id: envelope.data.id,
    character_id: envelope.data.character_id,
    content_id: envelope.data.content_id,
    content_version: envelope.data.content_version,
    context: envelope.data.context,
    choice_source: envelope.data.choice_source,
    created_at: envelope.data.created_at,
    content_definitions: definition,
  };
}

// React owns this memoization scope for one server render request. Sharing raw
// rows lets layout/page readers retain their own complete-snapshot validation.
async function readContentRefRows(characterId: string) {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("character_content_refs")
    .select(
      `id, character_id, content_id, content_version, context, choice_source, feature_grant_id, created_at,
       content_versions!character_content_refs_content_version_fkey (
         content_id, version, system_id_snapshot, content_type_snapshot,
         slug_snapshot, name_snapshot, data_snapshot, effects_snapshot,
         source_snapshot, scope_snapshot, owner_id_snapshot, created_at
       )`, { count: "exact" },
    )
    .eq("character_id", characterId);

  if (error) throw error;
  if (!Array.isArray(data) || count !== data.length) throw new Error("Saved content reference projection is incomplete.");
  return data ?? [];
}

const readContentRefRowsForRequest = cache(readContentRefRows);

export async function getContentRefsByCharacter(
  characterId: string,
  options: { requireCompleteSnapshots?: boolean; fresh?: boolean } = {},
): Promise<ContentRefWithContent[]> {
  const snapshot = await readCharacterContentRefSnapshot(characterId, options, true);
  if (options.requireCompleteSnapshots && !snapshot.complete) {
    throw new Error("Saved character snapshots could not be read. Reload before editing.");
  }
  return snapshot.refs;
}

/** Retain the existing sheet's degraded display while explicitly reporting
 * unreadable or mismatched recorded pins to consumers that need a complete
 * document. Shares the same request-scoped raw read; performs no extra query. */
export async function getCharacterContentRefSnapshot(
  characterId: string,
  options: { fresh?: boolean } = {},
): Promise<{ refs: ContentRefWithContent[]; complete: boolean; asiEvidence: AsiEvidence }> {
  return readCharacterContentRefSnapshot(characterId, options);
}

async function readCharacterContentRefSnapshot(
  characterId: string,
  options: { fresh?: boolean } = {},
  rejectReadErrors = false,
): Promise<{ refs: ContentRefWithContent[]; complete: boolean; asiEvidence: AsiEvidence }> {
  // Reads after a write in the same render must bypass its earlier snapshot.
  let data: unknown[] = [];
  let complete = true;
  try { data = await (options.fresh ? readContentRefRows : readContentRefRowsForRequest)(characterId); }
  catch (error) {
    // Ordinary callers rely on query failures propagating, rather than an empty
    // ref list being mistaken for a confirmed absence. The sheet snapshot keeps
    // its explicit degraded-read contract.
    if (rejectReadErrors) throw error;
    complete = false;
  }

  const refs: ContentRefWithContent[] = [];
  for (const row of data ?? []) {
    const ref = parseContentRefWithContent(row);
    if (ref === null ||
      ref.content_id !== ref.content_definitions.id ||
      ref.content_version !== ref.content_definitions.version) {
      complete = false;
    }
    if (ref !== null) refs.push(ref);
  }
  let asiEvidence: AsiEvidence = { status: "unavailable", reason: "incomplete_evidence" };
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return { refs, complete, asiEvidence };
    const [identity, grants] = await Promise.all([
      supabase.from("characters").select("id, system_id, game_systems (slug)").eq("id", characterId).single(),
      supabase.from("character_feature_grants").select("id, character_id, controller_ref_id, controller_type, controller_slug, feature_content_id, feature_version, feature_slug, unlock_level, created_at", { count: "exact" }).eq("character_id", characterId),
    ]);
    const parsed = z.array(frozenFeatureGrantSchema).safeParse(grants.data);
    const systemRelation = z.object({ slug: z.literal("dnd-5e-2014") });
    const parsedIdentity = z.object({ id: z.literal(characterId), system_id: z.uuid(),
      game_systems: z.union([systemRelation, z.tuple([systemRelation])]),
    }).safeParse(identity.data);
    if (complete && !identity.error && parsedIdentity.success && !grants.error && parsed.success && grants.count === parsed.data.length) {
      asiEvidence = { status: "complete", character_id: characterId, system_id: parsedIdentity.data.system_id, refs, grants: parsed.data };
    }
  } catch { /* Failure stays explicitly unavailable, never confirmed empty grants. */ }
  return { refs, complete, asiEvidence };
}

export async function addContentRef(params: {
  character_id: string;
  content_id: string;
  content_version: number;
  context: Record<string, unknown>;
  choice_source?: string | null;
}): Promise<CharacterContentRef> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .insert([
      {
        character_id: params.character_id,
        content_id: params.content_id,
        content_version: params.content_version,
        context: params.context,
        choice_source: params.choice_source ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeContentRef(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("character_content_refs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function removeContentRefsByChoiceSource(
  characterId: string,
  choiceSource: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("character_content_refs")
    .delete()
    .eq("character_id", characterId)
    .eq("choice_source", choiceSource);

  if (error) throw error;
}

export async function getContentRefsByChoiceSource(
  characterId: string,
  choiceSource: string,
): Promise<CharacterContentRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .select("*")
    .eq("character_id", characterId)
    .eq("choice_source", choiceSource);

  if (error) throw error;
  return data ?? [];
}
