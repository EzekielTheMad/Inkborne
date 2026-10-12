import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  mapHomebrewWeaponFormData,
  type HomebrewWeaponFormValue,
} from "@/lib/homebrew/weapon-form";
import {
  weaponDataSchema,
  type WeaponData,
} from "@/lib/schemas/content-types/weapon";
import { WEAPON_PROPERTIES } from "@/lib/types/taxonomies";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const HOMEBREW_SELECT =
  "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface HomebrewWeaponRecord {
  id: string;
  system_id: string;
  content_type: "weapon";
  slug: string;
  name: string;
  data: WeaponData;
  effects: unknown[];
  source: "homebrew";
  scope: "personal";
  owner_id: string;
  version: number;
  created_at: string;
  is_retired: boolean;
}

export type HomebrewWeaponMutationResult = {
  status: "idle" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type HomebrewWeaponMutationResponse =
  | HomebrewWeaponRecord
  | HomebrewWeaponMutationResult;

const rowEnvelopeSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string().uuid(),
  content_type: z.literal("weapon"),
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

function parseRecord(value: unknown): HomebrewWeaponRecord {
  const envelope = rowEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new Error("The database returned an invalid homebrew weapon row.");
  }

  const data = weaponDataSchema.safeParse(envelope.data.data);
  if (!data.success) {
    throw new Error("The database returned invalid homebrew weapon data.");
  }

  return { ...envelope.data, data: data.data };
}

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): HomebrewWeaponMutationResult {
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
    .replace(/^-+|-+$/g, "") || "homebrew-weapon";

  return `${base}-${randomUUID().slice(0, 8)}`;
}

function validateMappedWeapon(value: HomebrewWeaponFormValue):
  | { data: WeaponData }
  | { failure: HomebrewWeaponMutationResult } {
  const data = weaponDataSchema.safeParse(value.data);
  if (!data.success) {
    return {
      failure: failure("The weapon contains unsupported structured data."),
    };
  }
  return { data: data.data };
}

async function validateServerContext(
  supabase: ServerSupabaseClient,
): Promise<
  | { systemId: string }
  | { failure: HomebrewWeaponMutationResult }
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
      "The weapon identity conflicted with another save. Please try again.",
    );
  }
  return failure("The weapon could not be saved. Please try again.");
}

export async function listOwnedHomebrewWeapons(): Promise<
  HomebrewWeaponRecord[]
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
    .eq("content_type", "weapon")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  return (data ?? []).map(parseRecord);
}

export async function getOwnedHomebrewWeapon(
  id: string,
): Promise<HomebrewWeaponRecord | null> {
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
    .eq("content_type", "weapon")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function createHomebrewWeaponRecord(
  formData: FormData,
): Promise<HomebrewWeaponMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before creating a homebrew weapon.");
  }

  const parsed = mapHomebrewWeaponFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedWeapon(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .insert({
      system_id: context.systemId,
      content_type: "weapon",
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
    return failure("The weapon could not be saved. Please try again.");
  }
}

export async function updateHomebrewWeaponRecord(
  id: string,
  expectedVersion: number,
  formData: FormData,
): Promise<HomebrewWeaponMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before updating a homebrew weapon.");
  }

  const identity = z.object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ id, expectedVersion });
  if (!identity.success) {
    return failure("The weapon identifier or version is invalid.");
  }

  const parsed = mapHomebrewWeaponFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedWeapon(parsed.data);
  if ("failure" in content) return content.failure;

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
    .eq("content_type", "weapon")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .eq("version", identity.data.expectedVersion)
    .maybeSingle();
  if (readError) return databaseMutationFailure(readError);
  if (!existing) return classifyMissingUpdate(session.supabase, session.userId, context.systemId, identity.data.id);
  let mergedData: WeaponData;
  try {
    const currentData = parseRecord(existing).data;
    mergedData = weaponDataSchema.parse({
      ...currentData, ...parsed.data.data,
      properties: [...parsed.data.data.properties, ...currentData.properties.filter((property) => !WEAPON_PROPERTIES.some((known) => known === property))],
    });
  } catch {
    return failure("This weapon contains unsupported data and could not be edited.");
  }

  const { data, error } = await session.supabase
    .from("content_definitions")
    .update({
      name: parsed.data.name,
      data: mergedData as unknown as Json,
      // Effects are not authored here and remain unchanged.
    })
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "weapon")
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
      return failure("The weapon could not be saved. Please try again.");
    }
  }

  return classifyMissingUpdate(session.supabase, session.userId, context.systemId, identity.data.id);
}

async function classifyMissingUpdate(
  supabase: ServerSupabaseClient, userId: string, systemId: string, id: string,
): Promise<HomebrewWeaponMutationResult> {
  const { data: current, error: lookupError } = await supabase
    .from("content_definitions")
    .select("id, version")
    .eq("id", id)
    .eq("owner_id", userId)
    .eq("system_id", systemId)
    .eq("source", "homebrew")
    .eq("content_type", "weapon")
    .eq("scope", "personal")
    .eq("is_retired", false)
    .maybeSingle();

  if (lookupError) return databaseMutationFailure(lookupError);
  if (current) {
    return {
      status: "conflict",
      message:
        "This weapon changed in another session. Reload it before saving again.",
    };
  }

  return failure("This homebrew weapon could not be found.");
}
