import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  mapHomebrewRaceFormData,
} from "@/lib/homebrew/race-form";
import {
  raceDataSchema,
  type RaceData,
} from "@/lib/schemas/content-types/race";
import { inspectRaceWalkingEditability, raceCoreAnnotation, raceWalkingEffect, RACE_CORE_ANNOTATION_KEY } from "@/lib/homebrew/race-authoring";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const HOMEBREW_SELECT =
  "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface HomebrewRaceRecord {
  id: string;
  system_id: string;
  content_type: "race";
  slug: string;
  name: string;
  data: RaceData;
  effects: unknown[];
  source: "homebrew";
  scope: "personal";
  owner_id: string;
  version: number;
  created_at: string;
  is_retired: boolean;
  walkingEditable: boolean;
}

export type HomebrewRaceMutationResult = {
  status: "idle" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type HomebrewRaceMutationResponse =
  | HomebrewRaceRecord
  | HomebrewRaceMutationResult;

const rowEnvelopeSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string().uuid(),
  content_type: z.literal("race"),
  slug: z.string().min(1),
  name: z.string().min(1),
  data: z.unknown(),
  effects: z.array(z.unknown()),
  source: z.literal("homebrew"),
  scope: z.literal("personal"),
  owner_id: z.string().uuid(),
  version: z.number().int().positive(),
  created_at: z.string().min(1),
  is_retired: z.boolean(),
});

function parseRecord(value: unknown): HomebrewRaceRecord {
  const envelope = rowEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new Error("The database returned an invalid homebrew race row.");
  }

  const data = raceDataSchema.safeParse(envelope.data.data);
  if (!data.success) {
    throw new Error("The database returned invalid homebrew race data.");
  }

  return { ...envelope.data, data: data.data, walkingEditable: inspectRaceWalkingEditability(envelope.data.data, envelope.data.effects).editable };
}

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): HomebrewRaceMutationResult {
  return { status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) };
}

async function authenticatedSession(): Promise<
  | { supabase: ServerSupabaseClient; userId: string }
  | null
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { supabase, userId: user.id };
}

async function requireAuthenticatedSession() {
  const session = await authenticatedSession();
  if (!session) throw new Error("Authentication required.");
  return session;
}

async function resolvePublishedSystem(
  supabase: ServerSupabaseClient,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("game_systems")
    .select("id")
    .eq("slug", HOMEBREW_SYSTEM_SLUG)
    .eq("status", "published")
    .single();

  if (error || !data) return null;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(data);
  return parsed.success ? parsed.data : null;
}

function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "homebrew-race";

  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function validateServerContext(
  supabase: ServerSupabaseClient,
): Promise<
  | { systemId: string }
  | { failure: HomebrewRaceMutationResult }
> {
  const system = await resolvePublishedSystem(supabase);
  if (!system) {
    return { failure: failure("The D&D 5e (2014) system is unavailable.") };
  }
  return { systemId: system.id };
}

function databaseMutationFailure(error: { code?: string } | null) {
  if (error?.code === "23505") {
    return failure(
      "The race identity conflicted with another save. Please try again.",
    );
  }
  return failure("The race could not be saved. Please try again.");
}

export async function listOwnedHomebrewRaces(): Promise<
  HomebrewRaceRecord[]
> {
  const { supabase, userId } = await requireAuthenticatedSession();
  const system = await resolvePublishedSystem(supabase);
  if (!system) throw new Error("The D&D 5e (2014) system is unavailable.");

  const { data, error } = await supabase
    .from("content_definitions")
    .select(HOMEBREW_SELECT)
    .eq("owner_id", userId)
    .eq("system_id", system.id)
    .eq("source", "homebrew")
    .eq("content_type", "race")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  return (data ?? []).map(parseRecord);
}

export async function getOwnedHomebrewRace(
  id: string,
): Promise<HomebrewRaceRecord | null> {
  const { supabase, userId } = await requireAuthenticatedSession();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return null;

  const system = await resolvePublishedSystem(supabase);
  if (!system) throw new Error("The D&D 5e (2014) system is unavailable.");
  const { data, error } = await supabase
    .from("content_definitions")
    .select(HOMEBREW_SELECT)
    .eq("id", parsedId.data)
    .eq("owner_id", userId)
    .eq("system_id", system.id)
    .eq("source", "homebrew")
    .eq("content_type", "race")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function createHomebrewRaceRecord(
  formData: FormData,
): Promise<HomebrewRaceMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before creating a homebrew race.");
  }

  const parsed = mapHomebrewRaceFormData(formData, true);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const speed = parsed.data.walkingSpeed;
  const canonical = raceDataSchema.safeParse({ ...parsed.data.metadata, speed, speed_detail: { walk: speed } });
  if (!canonical.success || speed === undefined) return failure("The race contains unsupported structured data.");
  const effects = [raceWalkingEffect(speed)];
  const contentData = { ...canonical.data, [RACE_CORE_ANNOTATION_KEY]: raceCoreAnnotation(speed) };

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .insert({
      system_id: context.systemId,
      content_type: "race",
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      data: contentData as unknown as Json,
      effects: effects as unknown as Json,
      source: "homebrew",
      scope: "personal",
      owner_id: session.userId,
    })
    .select(HOMEBREW_SELECT)
    .single();

  if (error || !data) return databaseMutationFailure(error);
  try {
    return parseRecord(data);
  } catch {
    return failure("The race could not be saved. Please try again.");
  }
}

export async function updateHomebrewRaceRecord(
  id: string,
  expectedVersion: number,
  formData: FormData,
): Promise<HomebrewRaceMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before updating a homebrew race.");
  }

  const identity = z.object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ id, expectedVersion });
  if (!identity.success) {
    return failure("The race identifier or version is invalid.");
  }

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  // Preserve schema-supported extensions that the core form does not author.
  // Read only the exact owned active expected-version row; CAS below protects
  // against a change between this read and the metadata write.
  const { data: existing, error: readError } = await session.supabase
    .from("content_definitions")
    .select(HOMEBREW_SELECT)
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "race")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .eq("version", identity.data.expectedVersion)
    .maybeSingle();
  if (readError) return databaseMutationFailure(readError);
  if (!existing) return classifyMissingUpdate(session.supabase, session.userId, context.systemId, identity.data.id);
  let rawData: Record<string, unknown>;
  let rawEffects: unknown[];
  try {
    // The envelope validates an array of opaque values, without parsing or
    // stripping any fields from the original raw effect entries.
    rawEffects = parseRecord(existing).effects;
    rawData = z.record(z.string(), z.unknown()).parse(existing.data);
  } catch {
    return failure("This race contains unsupported data and could not be edited.");
  }
  // Annotation is an editing convention, not an authorization/provenance claim.
  // Its eligibility is recomputed from this authenticated expected-version row.
  const eligibility = inspectRaceWalkingEditability(rawData, rawEffects);
  const parsed = mapHomebrewRaceFormData(formData, eligibility.editable);
  if (!parsed.success) return failure("Check the highlighted fields and try again.", parsed.fieldErrors);
  const mergedData: Record<string, unknown> = { ...rawData, ...parsed.data.metadata };
  let updatedEffects: Json | undefined;
  if (eligibility.editable) {
    const speed = parsed.data.walkingSpeed;
    if (speed === undefined) return failure("The walking speed could not be validated.");
    mergedData.speed = speed;
    mergedData.speed_detail = { ...z.record(z.string(), z.unknown()).parse(rawData.speed_detail), walk: speed };
    mergedData[RACE_CORE_ANNOTATION_KEY] = raceCoreAnnotation(speed);
    // Preserve array position and every unrelated raw entry, including extras.
    updatedEffects = rawEffects.map((effect, index) => index === eligibility.effectIndex ? raceWalkingEffect(speed) : effect) as Json;
  }
  if (!raceDataSchema.safeParse(mergedData).success) return failure("This race contains unsupported data and could not be edited.");

  const { data, error } = await session.supabase
    .from("content_definitions")
    .update({
      name: parsed.data.name,
      data: mergedData as unknown as Json,
      ...(updatedEffects === undefined ? {} : { effects: updatedEffects }),
      // Metadata-only edits omit effects entirely; ambiguous walking stays intact.
    })
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "race")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .eq("version", identity.data.expectedVersion)
    .select(HOMEBREW_SELECT)
    .maybeSingle();

  if (error) return databaseMutationFailure(error);
  if (data) {
    try {
      return parseRecord(data);
    } catch {
      return failure("The race could not be saved. Please try again.");
    }
  }

  return classifyMissingUpdate(session.supabase, session.userId, context.systemId, identity.data.id);
}

async function classifyMissingUpdate(
  supabase: ServerSupabaseClient, userId: string, systemId: string, id: string,
): Promise<HomebrewRaceMutationResult> {
  const { data: current, error: lookupError } = await supabase
    .from("content_definitions")
    .select("id, version")
    .eq("id", id)
    .eq("owner_id", userId)
    .eq("system_id", systemId)
    .eq("source", "homebrew")
    .eq("content_type", "race")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (lookupError) return databaseMutationFailure(lookupError);
  if (current) {
    return {
      status: "conflict",
      message:
        "This race changed in another session. Reload it before saving again.",
    };
  }

  return failure("This homebrew race could not be found.");
}
