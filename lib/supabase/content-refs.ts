import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { CharacterContentRef } from "@/lib/types/character";

// ---------------------------------------------------------------------------
// content-refs.ts mixes SERVER-ONLY and BROWSER-ONLY helpers.
//
// Server-only (call from server components / route handlers / actions):
//   getContentRefsByCharacter, addContentRef, removeContentRef,
//   removeContentRefsByChoiceSource, getContentRefsByChoiceSource,
//   getContentByTypeAndSystem
//
// Browser-only (call from "use client" components):
//   insertContentRef, removeContentRefById
//
// Value-importing a server helper from a client component will fail at
// build time with a "next/headers is server-only" error. Use the
// browser-side primitives in that case.
// ---------------------------------------------------------------------------

export interface ContentRefWithContent extends CharacterContentRef {
  content_definitions: {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: import("@/lib/types/effects").Effect[];
  };
}

export async function getContentRefsByCharacter(
  characterId: string,
): Promise<ContentRefWithContent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .select(
      `*, content_definitions (id, name, slug, content_type, data, effects)`,
    )
    .eq("character_id", characterId);

  if (error) throw error;
  return (data ?? []) as ContentRefWithContent[];
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

export async function getContentByTypeAndSystem(
  systemId: string,
  contentType: string,
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: import("@/lib/types/effects").Effect[];
    version: number;
    source: string;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", contentType)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Browser-side helpers (used by builder step-clients).
//
// These call the synchronous browser supabase client so they can be invoked
// from `"use client"` components. They throw on supabase `{ error }`; callers
// are responsible for optimistic state + revert on failure.
// ---------------------------------------------------------------------------

export interface InsertContentRefParams {
  characterId: string;
  contentId: string;
  contentVersion: number;
  context: Record<string, unknown>;
  choiceSource?: string | null;
}

/**
 * Browser-side: insert a single content_ref row and return the inserted record.
 * Used by builder step-clients (race/class/subclass/background/fighting-style
 * selection).
 */
export async function insertContentRef(
  params: InsertContentRefParams,
): Promise<CharacterContentRef> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .insert([
      {
        character_id: params.characterId,
        content_id: params.contentId,
        content_version: params.contentVersion,
        context: params.context,
        choice_source: params.choiceSource ?? null,
      },
    ])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Browser-side: delete one content_ref row by its primary key. Used by
 * builder step-clients when swapping a selection — the caller has the id
 * already from the contentRefs prop and skips an extra lookup.
 */
export async function removeContentRefById(id: string): Promise<void> {
  const supabase = createBrowserClient();
  const { error } = await supabase
    .from("character_content_refs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
