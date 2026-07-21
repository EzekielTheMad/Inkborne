import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  mapHomebrewSpellFormData,
  type HomebrewSpellFormValue,
} from "@/lib/homebrew/spell-form";
import { spellDataSchema, type SpellData } from "@/lib/schemas/content-types/spell";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const HOME_BREW_SELECT =
  "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface HomebrewSpellRecord {
  id: string;
  system_id: string;
  content_type: "spell";
  slug: string;
  name: string;
  data: SpellData;
  effects: unknown[];
  source: "homebrew";
  scope: "personal" | "shared";
  owner_id: string;
  version: number;
  created_at: string;
  is_retired: boolean;
}

export interface OwnedHomebrewSpellSummary extends HomebrewSpellRecord {
  sharedCampaignCount: number;
}

export interface HomebrewSpellCampaignOption {
  id: string;
  name: string;
  shared: boolean;
  eligible: boolean;
}

export interface HomebrewSpellCampaignAccess {
  campaigns: HomebrewSpellCampaignOption[];
  sharedCampaignCount: number;
}

export interface HomebrewSpellShareSuccess {
  contentId: string;
  version: number;
  scope: "personal" | "shared";
  sharedCampaignCount: number;
}

export type HomebrewSpellShareMutationResponse =
  | HomebrewSpellShareSuccess
  | HomebrewSpellMutationResult;

export type HomebrewSpellMutationResult = {
  status: "idle" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type HomebrewSpellMutationResponse =
  | HomebrewSpellRecord
  | HomebrewSpellMutationResult;

export interface HomebrewSpellClassOption {
  slug: string;
  name: string;
}

const rowEnvelopeSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string().uuid(),
  content_type: z.literal("spell"),
  slug: z.string().min(1),
  name: z.string().min(1),
  data: z.unknown(),
  effects: z.array(z.unknown()),
  source: z.literal("homebrew"),
  scope: z.enum(["personal", "shared"]),
  owner_id: z.string().uuid(),
  version: z.number().int().positive(),
  created_at: z.string().min(1),
  is_retired: z.boolean(),
});

const classOptionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

const campaignAccessRpcRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  shared: z.boolean(),
  eligible: z.boolean(),
});

const contentShareSchema = z.object({
  content_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

const shareRpcRowSchema = z.object({
  content_id: z.string().uuid(),
  version: z.number().int().positive(),
  scope: z.enum(["personal", "shared"]),
  shared_campaign_count: z.number().int().nonnegative(),
});

function parseRecord(value: unknown): HomebrewSpellRecord {
  const envelope = rowEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new Error("The database returned an invalid homebrew spell row.");
  }

  const spellData = spellDataSchema.safeParse(envelope.data.data);
  if (!spellData.success) {
    throw new Error("The database returned invalid homebrew spell data.");
  }

  return { ...envelope.data, data: spellData.data };
}

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): HomebrewSpellMutationResult {
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

async function loadClassOptions(
  supabase: ServerSupabaseClient,
  systemId: string,
): Promise<HomebrewSpellClassOption[]> {
  const { data, error } = await supabase
    .from("content_definitions")
    .select("slug, name")
    .eq("system_id", systemId)
    .eq("content_type", "class")
    .eq("source", "srd")
    .eq("scope", "platform")
    .eq("is_retired", false)
    .order("name");

  if (error) throw new Error("Class options could not be loaded.");
  return z.array(classOptionSchema).parse(data ?? []);
}

function invalidClasses(
  value: HomebrewSpellFormValue,
  options: HomebrewSpellClassOption[],
): string[] {
  const allowed = new Set(options.map((option) => option.slug));
  return value.data.classes.filter((classSlug) => !allowed.has(classSlug));
}

function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "homebrew-spell";

  // Slugs are immutable content identity. A server-generated suffix prevents
  // same-owner collisions while staying stable for every later version.
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function validateServerContext(
  supabase: ServerSupabaseClient,
  value: HomebrewSpellFormValue,
): Promise<
  | { systemId: string }
  | { failure: HomebrewSpellMutationResult }
> {
  const system = await resolvePublishedSystem(supabase);
  if (!system) {
    return { failure: failure("The D&D 5e (2014) system is unavailable.") };
  }

  if (value.systemId && value.systemId !== system.id) {
    return {
      failure: failure("The selected game system is not available for this spell.", {
        system_id: ["Choose the published D&D 5e (2014) system."],
      }),
    };
  }

  let options: HomebrewSpellClassOption[];
  try {
    options = await loadClassOptions(supabase, system.id);
  } catch {
    return { failure: failure("Spell class options could not be verified.") };
  }

  const invalid = invalidClasses(value, options);
  if (invalid.length > 0) {
    return {
      failure: failure("One or more selected classes are invalid.", {
        classes: invalid.map((slug) => `Unknown class: ${slug}`),
      }),
    };
  }

  return { systemId: system.id };
}

function databaseMutationFailure(error: { code?: string } | null) {
  if (error?.code === "23505") {
    return failure("You already have a spell with this name.", {
      name: ["Choose a unique spell name."],
    });
  }
  return failure("The spell could not be saved. Please try again.");
}

function databaseShareFailure(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  if (
    error?.code === "40001"
    || (error?.code === "P0001" && /(stale|version|conflict)/.test(message))
  ) {
    return {
      status: "conflict" as const,
      message: "This spell changed in another session. Reload it before changing campaign access.",
    };
  }
  return failure("Campaign access could not be updated. Please try again.");
}

function parseShareRpcRow(value: unknown): HomebrewSpellShareSuccess {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = shareRpcRowSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error("The database returned an invalid campaign share result.");
  }
  return {
    contentId: parsed.data.content_id,
    version: parsed.data.version,
    scope: parsed.data.scope,
    sharedCampaignCount: parsed.data.shared_campaign_count,
  };
}

async function loadOwnedCampaignAccess(
  supabase: ServerSupabaseClient,
  contentId: string,
): Promise<HomebrewSpellCampaignAccess> {
  const { data, error } = await supabase.rpc("list_owned_content_campaign_access", {
    target_content_id: contentId,
  });
  if (error) throw error;
  const campaigns = z.array(campaignAccessRpcRowSchema).parse(data ?? []);
  return {
    campaigns,
    sharedCampaignCount: campaigns.filter((campaign) => campaign.shared).length,
  };
}

export async function listHomebrewSpellClassOptions(): Promise<
  HomebrewSpellClassOption[]
> {
  const { supabase } = await requireAuthenticatedSession();
  const system = await resolvePublishedSystem(supabase);
  if (!system) throw new Error("The D&D 5e (2014) system is unavailable.");
  return loadClassOptions(supabase, system.id);
}

export async function listOwnedHomebrewSpells(): Promise<OwnedHomebrewSpellSummary[]> {
  const { supabase, userId } = await requireAuthenticatedSession();
  const system = await resolvePublishedSystem(supabase);
  if (!system) throw new Error("The D&D 5e (2014) system is unavailable.");
  const { data, error } = await supabase
    .from("content_definitions")
    .select(HOME_BREW_SELECT)
    .eq("owner_id", userId)
    .eq("system_id", system.id)
    .eq("source", "homebrew")
    .eq("content_type", "spell")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  const spells = (data ?? []).map(parseRecord);
  const sharedIds = spells
    .filter((spell) => spell.scope === "shared")
    .map((spell) => spell.id);
  if (sharedIds.length === 0) {
    return spells.map((spell) => ({ ...spell, sharedCampaignCount: 0 }));
  }

  const { data: shares, error: sharesError } = await supabase
    .from("content_shares")
    .select("content_id, campaign_id")
    .in("content_id", sharedIds);
  if (sharesError) throw sharesError;

  const counts = new Map<string, number>();
  for (const share of z.array(contentShareSchema).parse(shares ?? [])) {
    counts.set(share.content_id, (counts.get(share.content_id) ?? 0) + 1);
  }
  return spells.map((spell) => ({
    ...spell,
    sharedCampaignCount: counts.get(spell.id) ?? 0,
  }));
}

export async function getOwnedHomebrewSpell(
  id: string,
): Promise<HomebrewSpellRecord | null> {
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
    .eq("content_type", "spell")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function getHomebrewSpellCampaignAccess(
  id: string,
): Promise<HomebrewSpellCampaignAccess | null> {
  const { supabase } = await requireAuthenticatedSession();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return null;
  try {
    return await loadOwnedCampaignAccess(supabase, parsedId.data);
  } catch (error) {
    if ((error as { code?: string }).code === "42501") return null;
    throw error;
  }
}

export async function setHomebrewSpellCampaignShare(
  contentId: string,
  campaignId: string,
  enabled: boolean,
  expectedVersion: number,
): Promise<HomebrewSpellShareMutationResponse> {
  const session = await authenticatedSession();
  if (!session) return failure("Sign in before changing campaign access.");

  const input = z.object({
    contentId: z.string().uuid(),
    campaignId: z.string().uuid(),
    enabled: z.boolean(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ contentId, campaignId, enabled, expectedVersion });
  if (!input.success) return failure("The spell, campaign, or version is invalid.");

  const { data, error } = await session.supabase.rpc("set_content_campaign_share", {
    target_content_id: input.data.contentId,
    target_campaign_id: input.data.campaignId,
    enabled: input.data.enabled,
    expected_version: input.data.expectedVersion,
  });
  if (error) return databaseShareFailure(error);

  try {
    const result = parseShareRpcRow(data);
    if (result.contentId !== input.data.contentId) {
      return failure("Campaign access could not be updated. Please try again.");
    }
    return result;
  } catch {
    return failure("Campaign access could not be updated. Please try again.");
  }
}

export async function createHomebrewSpellRecord(
  formData: FormData,
): Promise<HomebrewSpellMutationResponse> {
  const session = await authenticatedSession();
  if (!session) return failure("Sign in before creating a homebrew spell.");

  const parsed = mapHomebrewSpellFormData(formData);
  if (!parsed.success) {
    return failure("Check the highlighted fields and try again.", parsed.fieldErrors);
  }

  const context = await validateServerContext(session.supabase, parsed.data);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .insert({
      system_id: context.systemId,
      content_type: "spell",
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      data: parsed.data.data as unknown as Json,
      effects: [],
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
    return failure("The spell could not be saved. Please try again.");
  }
}

export async function updateHomebrewSpellRecord(
  id: string,
  expectedVersion: number,
  formData: FormData,
): Promise<HomebrewSpellMutationResponse> {
  const session = await authenticatedSession();
  if (!session) return failure("Sign in before updating a homebrew spell.");

  const identity = z.object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ id, expectedVersion });
  if (!identity.success) return failure("The spell identifier or version is invalid.");

  const parsed = mapHomebrewSpellFormData(formData);
  if (!parsed.success) {
    return failure("Check the highlighted fields and try again.", parsed.fieldErrors);
  }

  const context = await validateServerContext(session.supabase, parsed.data);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .update({
      name: parsed.data.name,
      data: parsed.data.data as unknown as Json,
      effects: [],
    })
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "spell")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .eq("version", identity.data.expectedVersion)
    .select(HOME_BREW_SELECT)
    .maybeSingle();

  if (error) return databaseMutationFailure(error);
  if (data) {
    try {
      return parseRecord(data);
    } catch {
      return failure("The spell could not be saved. Please try again.");
    }
  }

  const { data: current, error: lookupError } = await session.supabase
    .from("content_definitions")
    .select("id, version")
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "spell")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .maybeSingle();

  if (lookupError) return databaseMutationFailure(lookupError);
  if (current) {
    return {
      status: "conflict",
      message: "This spell changed in another session. Reload it before saving again.",
    };
  }

  return failure("This homebrew spell could not be found.");
}
