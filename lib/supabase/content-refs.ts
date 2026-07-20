import "server-only";

import { z } from "zod";

import {
  parseNestedContentVersionSnapshot,
  type ParsedContentDefinition,
} from "@/lib/supabase/content-definitions-parser";
import { createClient } from "@/lib/supabase/server";
import type { CharacterContentRef } from "@/lib/types/character";

export interface ContentRefWithContent extends CharacterContentRef {
  content_definitions: ParsedContentDefinition;
}

const contentRefEnvelopeSchema = z.object({
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

export async function getContentRefsByCharacter(
  characterId: string,
): Promise<ContentRefWithContent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .select(
      `id, character_id, content_id, content_version, context, choice_source, created_at,
       content_versions!character_content_refs_content_version_fkey (
         content_id, version, system_id_snapshot, content_type_snapshot,
         slug_snapshot, name_snapshot, data_snapshot, effects_snapshot,
         source_snapshot, scope_snapshot, owner_id_snapshot, created_at
       )`,
    )
    .eq("character_id", characterId);

  if (error) throw error;

  const refs: ContentRefWithContent[] = [];
  for (const row of data ?? []) {
    const ref = parseContentRefWithContent(row);
    if (ref !== null) refs.push(ref);
  }
  return refs;
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
