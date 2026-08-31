import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  mapHomebrewMagicItemFormData,
  type HomebrewMagicItemFormValue,
} from "@/lib/homebrew/magic-item-form";
import {
  magicItemDataSchema,
  type MagicItemData,
} from "@/lib/schemas/content-types/magic-item";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const HOMEBREW_SELECT =
  "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface HomebrewMagicItemRecord {
  id: string;
  system_id: string;
  content_type: "magic_item";
  slug: string;
  name: string;
  data: MagicItemData;
  effects: unknown[];
  source: "homebrew";
  scope: "personal";
  owner_id: string;
  version: number;
  created_at: string;
  is_retired: boolean;
}

export type HomebrewMagicItemMutationResult = {
  status: "idle" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type HomebrewMagicItemMutationResponse =
  | HomebrewMagicItemRecord
  | HomebrewMagicItemMutationResult;

const rowEnvelopeSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string().uuid(),
  content_type: z.literal("magic_item"),
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

function parseRecord(value: unknown): HomebrewMagicItemRecord {
  const envelope = rowEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new Error("The database returned an invalid homebrew magic-item row.");
  }

  const data = magicItemDataSchema.safeParse(envelope.data.data);
  if (!data.success) {
    throw new Error("The database returned invalid homebrew magic-item data.");
  }

  return { ...envelope.data, data: data.data };
}

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): HomebrewMagicItemMutationResult {
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
  const parsed = z.object({ id: z.string().uuid() }).safeParse(data);
  return parsed.success ? parsed.data : null;
}

function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "homebrew-magic-item";

  return `${base}-${randomUUID().slice(0, 8)}`;
}

function validateMappedMagicItem(value: HomebrewMagicItemFormValue):
  | { data: MagicItemData }
  | { failure: HomebrewMagicItemMutationResult } {
  const data = magicItemDataSchema.safeParse(value.data);
  if (!data.success) {
    return {
      failure: failure("The magic item contains unsupported structured data."),
    };
  }
  return { data: data.data };
}

async function validateServerContext(
  supabase: ServerSupabaseClient,
): Promise<
  | { systemId: string }
  | { failure: HomebrewMagicItemMutationResult }
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
      "The magic-item identity conflicted with another save. Please try again.",
    );
  }
  return failure("The magic item could not be saved. Please try again.");
}

export async function listOwnedHomebrewMagicItems(): Promise<
  HomebrewMagicItemRecord[]
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
    .eq("content_type", "magic_item")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  return (data ?? []).map(parseRecord);
}

export async function getOwnedHomebrewMagicItem(
  id: string,
): Promise<HomebrewMagicItemRecord | null> {
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
    .eq("content_type", "magic_item")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function createHomebrewMagicItemRecord(
  formData: FormData,
): Promise<HomebrewMagicItemMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before creating a homebrew magic item.");
  }

  const parsed = mapHomebrewMagicItemFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedMagicItem(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .insert({
      system_id: context.systemId,
      content_type: "magic_item",
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      data: content.data as unknown as Json,
      effects: [],
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
    return failure("The magic item could not be saved. Please try again.");
  }
}

export async function updateHomebrewMagicItemRecord(
  id: string,
  expectedVersion: number,
  formData: FormData,
): Promise<HomebrewMagicItemMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before updating a homebrew magic item.");
  }

  const identity = z.object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ id, expectedVersion });
  if (!identity.success) {
    return failure("The magic-item identifier or version is invalid.");
  }

  const parsed = mapHomebrewMagicItemFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedMagicItem(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .update({
      name: parsed.data.name,
      data: content.data as unknown as Json,
      effects: [],
    })
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "magic_item")
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
      return failure("The magic item could not be saved. Please try again.");
    }
  }

  const { data: current, error: lookupError } = await session.supabase
    .from("content_definitions")
    .select("id, version")
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "magic_item")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (lookupError) return databaseMutationFailure(lookupError);
  if (current) {
    return {
      status: "conflict",
      message:
        "This magic item changed in another session. Reload it before saving again.",
    };
  }

  return failure("This homebrew magic item could not be found.");
}
