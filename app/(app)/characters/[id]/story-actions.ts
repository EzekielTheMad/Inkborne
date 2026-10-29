"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { z } from "zod";
import { isRichTextDocument, normalizeRichTextContent } from "@/lib/editor/content";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { CharacterStoryVisibility, CharacterTimelineEvent } from "@/lib/types/narrative";

const idSchema = z.string().uuid();
const visibilitySchema = z.enum(["dm_only", "campaign"]);

const timelineInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  dateLabel: z.string().trim().max(80).nullable(),
  description: z.unknown(),
  visibility: visibilitySchema,
  sortOrder: z.number().int().min(-2147483648).max(2147483647),
  entryId: idSchema.optional(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
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
  /** Stable identity for a single create attempt; never an upsert key. */
  entryId?: string;
  /** Timestamp from the entry snapshot opened for editing. */
  expectedUpdatedAt?: string;
}

type TimelineFailure =
  | { status: "rejected"; code: "invalid" | "not_authorized" | "reopen_required"; error: string }
  | { status: "conflict"; error: string }
  | { status: "unknown"; error: string };
export type TimelineSaveResult = { status: "saved"; entryId: string; updatedAt: string } | TimelineFailure;
export type TimelineReadbackResult = { status: "found"; entry: CharacterTimelineEvent } | { status: "absent" } | TimelineFailure;

const acknowledgementSchema = z.object({ id: idSchema, updated_at: z.string().datetime({ offset: true }) });
const readbackSchema = acknowledgementSchema.extend({
  character_id: idSchema, created_by: idSchema, title: z.string(), date_label: z.string().nullable(),
  description: z.unknown().refine(isRichTextDocument), visibility: visibilitySchema,
  sort_order: z.number().int(), created_at: z.string().datetime({ offset: true }),
});
const timelineUnknown = (): TimelineFailure => ({ status: "unknown", error: "Save status unknown. Keep your draft and check the saved entry before trying again." });
const timelineRejected = (code: "invalid" | "not_authorized" | "reopen_required", error: string): TimelineFailure => ({ status: "rejected", code, error });

async function timelineOwner(characterId: string) {
  try { return await authenticatedOwner(characterId); }
  catch (error) { unstable_rethrow(error); return null; } // No mutation has been attempted.
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
): Promise<TimelineSaveResult> {
  const parsed = timelineInputSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(characterId).success) return timelineRejected("invalid", "Check the timeline event fields");
  if (!parsed.data.entryId) return timelineRejected("reopen_required", "Reopen the journal before creating an entry");
  const ctx = await timelineOwner(characterId);
  if (!ctx) return timelineRejected("not_authorized", "Not authorized");
  try {
    const { data, error } = await ctx.supabase.from("character_timeline_events").insert({
      id: parsed.data.entryId,
      character_id: ctx.characterId,
      created_by: ctx.user.id,
      title: parsed.data.title,
      date_label: parsed.data.dateLabel || null,
      description: normalizeRichTextContent(parsed.data.description) as Json,
      visibility: parsed.data.visibility,
      sort_order: parsed.data.sortOrder,
    }).select("id, updated_at").single();
    if (error?.code === "23505") return { status: "conflict", error: "This entry identity is already recorded or unavailable. Keep your draft and check the saved entry." };
    if (error) return timelineUnknown();
    const acknowledgement = acknowledgementSchema.safeParse(data);
    if (!acknowledgement.success || acknowledgement.data.id !== parsed.data.entryId) return timelineUnknown();
    revalidatePath(`/characters/${ctx.characterId}`);
    return { status: "saved", entryId: acknowledgement.data.id, updatedAt: acknowledgement.data.updated_at };
  } catch (error) { unstable_rethrow(error); return timelineUnknown(); }
}

export async function updateTimelineEvent(
  characterId: string,
  eventId: string,
  input: TimelineEventInput,
): Promise<TimelineSaveResult> {
  const parsed = timelineInputSchema.safeParse(input);
  const parsedEventId = idSchema.safeParse(eventId);
  if (!parsed.success || !parsedEventId.success || !idSchema.safeParse(characterId).success) return timelineRejected("invalid", "Check the timeline event fields");
  if (!parsed.data.expectedUpdatedAt) return timelineRejected("reopen_required", "Reopen this entry before saving");
  const ctx = await timelineOwner(characterId);
  if (!ctx) return timelineRejected("not_authorized", "Not authorized");
  // Advance even when the clock is behind the opened timestamp or two edits
  // happen within one millisecond. Postgres compares the full opened timestamp.
  const nextTimestamp = new Date(Math.max(Date.now(), Date.parse(parsed.data.expectedUpdatedAt) + 1)).toISOString();
  try {
    const { data, error } = await ctx.supabase
    .from("character_timeline_events")
    .update({
      title: parsed.data.title,
      date_label: parsed.data.dateLabel || null,
      description: normalizeRichTextContent(parsed.data.description) as Json,
      visibility: parsed.data.visibility,
      sort_order: parsed.data.sortOrder,
      updated_at: nextTimestamp,
    })
    .eq("id", parsedEventId.data)
    .eq("character_id", ctx.characterId)
    .eq("created_by", ctx.user.id)
    .eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("id, updated_at").maybeSingle();
    if (error) return timelineUnknown();
    if (!data) return { status: "conflict", error: "This entry changed or was removed. Keep your draft and reopen it before saving." };
    const acknowledgement = acknowledgementSchema.safeParse(data);
    if (!acknowledgement.success || acknowledgement.data.id !== parsedEventId.data ||
        Date.parse(acknowledgement.data.updated_at) !== Date.parse(nextTimestamp) ||
        /[1-9]/.test((acknowledgement.data.updated_at.match(/\.(\d+)/)?.[1] ?? "").slice(3))) return timelineUnknown();
    revalidatePath(`/characters/${ctx.characterId}`);
    return { status: "saved", entryId: acknowledgement.data.id, updatedAt: acknowledgement.data.updated_at };
  } catch (error) { unstable_rethrow(error); return timelineUnknown(); }
}

/** Read-only recovery. Identity is the exact attempted ID, never title/body. */
export async function readTimelineEvent(characterId: string, eventId: string): Promise<TimelineReadbackResult> {
  if (!idSchema.safeParse(characterId).success || !idSchema.safeParse(eventId).success) return timelineRejected("invalid", "Invalid journal entry identity");
  const ctx = await timelineOwner(characterId);
  if (!ctx) return timelineRejected("not_authorized", "Not authorized");
  try {
    const { data, error } = await ctx.supabase.from("character_timeline_events")
      .select("id, character_id, created_by, title, date_label, description, visibility, sort_order, created_at, updated_at")
      .eq("id", eventId).eq("character_id", ctx.characterId).eq("created_by", ctx.user.id).maybeSingle();
    if (error) return timelineUnknown();
    if (!data) return { status: "absent" };
    const row = readbackSchema.safeParse(data);
    if (!row.success || row.data.id !== eventId || row.data.character_id !== ctx.characterId || row.data.created_by !== ctx.user.id) return timelineUnknown();
    revalidatePath(`/characters/${ctx.characterId}`);
    return { status: "found", entry: { ...row.data, description: normalizeRichTextContent(row.data.description) } };
  } catch (error) { unstable_rethrow(error); return timelineUnknown(); }
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
