import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { mapHomebrewFeatFormData } from "@/lib/homebrew/feat-form";
import { featDataSchema, type FeatData } from "@/lib/schemas/content-types/feat";
import { effectSchema } from "@/lib/schemas/effects";
import type { Effect } from "@/lib/types/effects";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const HOME_BREW_SELECT =
  "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface HomebrewFeatRecord {
  id: string;
  system_id: string;
  content_type: "feat";
  slug: string;
  name: string;
  data: FeatData;
  effects: Effect[];
  source: "homebrew";
  scope: "personal";
  owner_id: string;
  version: number;
  created_at: string;
  is_retired: boolean;
}

export type HomebrewFeatMutationResult = {
  status: "idle" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type HomebrewFeatMutationResponse =
  | HomebrewFeatRecord
  | HomebrewFeatMutationResult;

const rowEnvelopeSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string().uuid(),
  content_type: z.literal("feat"),
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

function parseRecord(value: unknown): HomebrewFeatRecord {
  const envelope = rowEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new Error("The database returned an invalid homebrew feat row.");
  }

  const data = featDataSchema.safeParse(envelope.data.data);
  const effects = z.array(effectSchema).safeParse(envelope.data.effects);
  if (!data.success || !effects.success) {
    throw new Error("The database returned invalid homebrew feat content.");
  }

  return { ...envelope.data, data: data.data, effects: effects.data };
}

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): HomebrewFeatMutationResult {
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
    .maybeSingle();

  if (error || !data) return null;
  return z.object({ id: z.string().uuid() }).parse(data);
}

function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "homebrew-feat";

  // Slugs are immutable content identity. The suffix avoids collisions while
  // keeping every later version of this feat under the same identity.
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function validateServerContext(
  supabase: ServerSupabaseClient,
): Promise<{ systemId: string } | { failure: HomebrewFeatMutationResult }> {
  const system = await resolvePublishedSystem(supabase);
  if (!system) {
    return { failure: failure("The D&D 5e (2014) system is unavailable.") };
  }

  return { systemId: system.id };
}

function databaseMutationFailure(error: { code?: string } | null) {
  if (error?.code === "23505") {
    return failure("The feat identity conflicted with another save. Please try again.");
  }
  return failure("The feat could not be saved. Please try again.");
}

/**
 * The form mapper constructs the only supported payload and derives its
 * effects, but the DAL repeats both schema checks at the trust boundary before
 * the values reach persistence. This also protects future mapper changes.
 */
function validateMappedFeat(value: { data: unknown; effects: unknown }):
  | { data: FeatData; effects: Effect[] }
  | { failure: HomebrewFeatMutationResult } {
  const data = featDataSchema.safeParse(value.data);
  const effects = z.array(effectSchema).safeParse(value.effects);
  if (!data.success || !effects.success) {
    return { failure: failure("The feat contains unsupported structured data.") };
  }
  return { data: data.data, effects: effects.data };
}

/** Return every active personal feat the authenticated owner may edit. */
export async function listOwnedHomebrewFeats(): Promise<HomebrewFeatRecord[]> {
  const { supabase, userId } = await requireAuthenticatedSession();
  const system = await resolvePublishedSystem(supabase);
  if (!system) throw new Error("The D&D 5e (2014) system is unavailable.");

  const { data, error } = await supabase
    .from("content_definitions")
    .select(HOME_BREW_SELECT)
    .eq("owner_id", userId)
    .eq("system_id", system.id)
    .eq("source", "homebrew")
    .eq("content_type", "feat")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  return (data ?? []).map(parseRecord);
}

/** Return a feat only when it is still active, private, and owned by caller. */
export async function getOwnedHomebrewFeat(
  id: string,
): Promise<HomebrewFeatRecord | null> {
  const { supabase, userId } = await requireAuthenticatedSession();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return null;

  const system = await resolvePublishedSystem(supabase);
  if (!system) throw new Error("The D&D 5e (2014) system is unavailable.");
  const { data, error } = await supabase
    .from("content_definitions")
    .select(HOME_BREW_SELECT)
    .eq("id", parsedId.data)
    .eq("owner_id", userId)
    .eq("system_id", system.id)
    .eq("source", "homebrew")
    .eq("content_type", "feat")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function createHomebrewFeatRecord(
  formData: FormData,
): Promise<HomebrewFeatMutationResponse> {
  const session = await authenticatedSession();
  if (!session) return failure("Sign in before creating a homebrew feat.");

  const parsed = mapHomebrewFeatFormData(formData);
  if (!parsed.success) {
    return failure("Check the highlighted fields and try again.", parsed.fieldErrors);
  }

  const content = validateMappedFeat(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .insert({
      system_id: context.systemId,
      content_type: "feat",
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      data: content.data as unknown as Json,
      effects: content.effects as unknown as Json,
      source: "homebrew",
      scope: "personal",
      owner_id: session.userId,
    })
    .select(HOME_BREW_SELECT)
    .single();

  if (error || !data) return databaseMutationFailure(error);
  try {
    return parseRecord(data);
  } catch {
    return failure("The feat could not be saved. Please try again.");
  }
}

export async function updateHomebrewFeatRecord(
  id: string,
  expectedVersion: number,
  formData: FormData,
): Promise<HomebrewFeatMutationResponse> {
  const session = await authenticatedSession();
  if (!session) return failure("Sign in before updating a homebrew feat.");

  const identity = z.object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ id, expectedVersion });
  if (!identity.success) return failure("The feat identifier or version is invalid.");

  const parsed = mapHomebrewFeatFormData(formData);
  if (!parsed.success) {
    return failure("Check the highlighted fields and try again.", parsed.fieldErrors);
  }

  const content = validateMappedFeat(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .update({
      name: parsed.data.name,
      data: content.data as unknown as Json,
      effects: content.effects as unknown as Json,
    })
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "feat")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .eq("version", identity.data.expectedVersion)
    .select(HOME_BREW_SELECT)
    .maybeSingle();

  if (error) return databaseMutationFailure(error);
  if (data) {
    try {
      return parseRecord(data);
    } catch {
      return failure("The feat could not be saved. Please try again.");
    }
  }

  const { data: current, error: lookupError } = await session.supabase
    .from("content_definitions")
    .select("id, version")
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "feat")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (lookupError) return databaseMutationFailure(lookupError);
  if (current) {
    return {
      status: "conflict",
      message: "This feat changed in another session. Reload it before saving again.",
    };
  }

  return failure("This homebrew feat could not be found.");
}
