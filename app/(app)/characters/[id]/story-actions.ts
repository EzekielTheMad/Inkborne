"use server";

import { revalidatePath } from "next/cache";
import type { JSONContent } from "@tiptap/react";
import { z } from "zod";
import { normalizeRichTextContent } from "@/lib/editor/content";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { CharacterStoryVisibility } from "@/lib/types/narrative";

const idSchema = z.string().uuid();
const visibilitySchema = z.enum(["dm_only", "campaign"]);

const timelineInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  dateLabel: z.string().trim().max(80).nullable(),
  description: z.unknown(),
  visibility: visibilitySchema,
  sortOrder: z.number().int(),
});

const relationshipInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().max(120).nullable(),
  description: z.unknown(),
  visibility: visibilitySchema,
});

export interface TimelineEventInput {
  title: string;
  dateLabel: string | null;
  description: JSONContent | null;
  visibility: CharacterStoryVisibility;
  sortOrder: number;
}

export interface RelationshipInput {
  name: string;
  relationship: string | null;
  description: JSONContent | null;
  visibility: CharacterStoryVisibility;
}

type ActionResult = { success: true } | { error: string };

async function authenticatedOwner(characterId: string) {
  const parsedId = idSchema.safeParse(characterId);
  if (!parsedId.success) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: character } = await supabase
    .from("characters")
    .select("id")
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  return character ? { supabase, user, characterId: parsedId.data } : null;
}

function errorMessage(error: { message: string } | null): ActionResult {
  return { error: error?.message ?? "Unable to save this entry" };
}

export async function createTimelineEvent(
  characterId: string,
  input: TimelineEventInput,
): Promise<ActionResult> {
  const ctx = await authenticatedOwner(characterId);
  const parsed = timelineInputSchema.safeParse(input);
  if (!ctx) return { error: "Not authorized" };
  if (!parsed.success) return { error: "Check the timeline event fields" };

  const { error } = await ctx.supabase.from("character_timeline_events").insert({
    character_id: ctx.characterId,
    created_by: ctx.user.id,
    title: parsed.data.title,
    date_label: parsed.data.dateLabel || null,
    description: normalizeRichTextContent(parsed.data.description) as Json,
    visibility: parsed.data.visibility,
    sort_order: parsed.data.sortOrder,
  });
  if (error) return errorMessage(error);
  revalidatePath(`/characters/${ctx.characterId}`);
  return { success: true };
}

export async function updateTimelineEvent(
  characterId: string,
  eventId: string,
  input: TimelineEventInput,
): Promise<ActionResult> {
  const ctx = await authenticatedOwner(characterId);
  const parsed = timelineInputSchema.safeParse(input);
  const parsedEventId = idSchema.safeParse(eventId);
  if (!ctx) return { error: "Not authorized" };
  if (!parsed.success || !parsedEventId.success) return { error: "Check the timeline event fields" };

  const { error } = await ctx.supabase
    .from("character_timeline_events")
    .update({
      title: parsed.data.title,
      date_label: parsed.data.dateLabel || null,
      description: normalizeRichTextContent(parsed.data.description) as Json,
      visibility: parsed.data.visibility,
      sort_order: parsed.data.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedEventId.data)
    .eq("character_id", ctx.characterId);
  if (error) return errorMessage(error);
  revalidatePath(`/characters/${ctx.characterId}`);
  return { success: true };
}

export async function deleteTimelineEvent(
  characterId: string,
  eventId: string,
): Promise<ActionResult> {
  const ctx = await authenticatedOwner(characterId);
  const parsedEventId = idSchema.safeParse(eventId);
  if (!ctx) return { error: "Not authorized" };
  if (!parsedEventId.success) return { error: "Invalid timeline event" };
  const { error } = await ctx.supabase
    .from("character_timeline_events")
    .delete()
    .eq("id", parsedEventId.data)
    .eq("character_id", ctx.characterId);
  if (error) return errorMessage(error);
  revalidatePath(`/characters/${ctx.characterId}`);
  return { success: true };
}

export async function createRelationship(
  characterId: string,
  input: RelationshipInput,
): Promise<ActionResult> {
  const ctx = await authenticatedOwner(characterId);
  const parsed = relationshipInputSchema.safeParse(input);
  if (!ctx) return { error: "Not authorized" };
  if (!parsed.success) return { error: "Check the relationship fields" };

  const { error } = await ctx.supabase.from("npcs").insert({
    character_id: ctx.characterId,
    created_by: ctx.user.id,
    name: parsed.data.name,
    relationship: parsed.data.relationship || null,
    description: normalizeRichTextContent(parsed.data.description) as Json,
    visibility: parsed.data.visibility,
  });
  if (error) return errorMessage(error);
  revalidatePath(`/characters/${ctx.characterId}`);
  return { success: true };
}

export async function updateRelationship(
  characterId: string,
  relationshipId: string,
  input: RelationshipInput,
): Promise<ActionResult> {
  const ctx = await authenticatedOwner(characterId);
  const parsed = relationshipInputSchema.safeParse(input);
  const parsedRelationshipId = idSchema.safeParse(relationshipId);
  if (!ctx) return { error: "Not authorized" };
  if (!parsed.success || !parsedRelationshipId.success) return { error: "Check the relationship fields" };

  const { error } = await ctx.supabase
    .from("npcs")
    .update({
      name: parsed.data.name,
      relationship: parsed.data.relationship || null,
      description: normalizeRichTextContent(parsed.data.description) as Json,
      visibility: parsed.data.visibility,
    })
    .eq("id", parsedRelationshipId.data)
    .eq("character_id", ctx.characterId);
  if (error) return errorMessage(error);
  revalidatePath(`/characters/${ctx.characterId}`);
  return { success: true };
}

export async function deleteRelationship(
  characterId: string,
  relationshipId: string,
): Promise<ActionResult> {
  const ctx = await authenticatedOwner(characterId);
  const parsedRelationshipId = idSchema.safeParse(relationshipId);
  if (!ctx) return { error: "Not authorized" };
  if (!parsedRelationshipId.success) return { error: "Invalid relationship" };
  const { error } = await ctx.supabase
    .from("npcs")
    .delete()
    .eq("id", parsedRelationshipId.data)
    .eq("character_id", ctx.characterId);
  if (error) return errorMessage(error);
  revalidatePath(`/characters/${ctx.characterId}`);
  return { success: true };
}
