import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { mapHomebrewBackgroundFormData } from "@/lib/homebrew/background-form";
import {
  backgroundDataSchema,
  type BackgroundData,
} from "@/lib/schemas/content-types/background";
import { effectSchema } from "@/lib/schemas/effects";
import type { Effect } from "@/lib/types/effects";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const HOMEBREW_SELECT =
  "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface HomebrewBackgroundRecord {
  id: string;
  system_id: string;
  content_type: "background";
  slug: string;
  name: string;
  data: BackgroundData;
  effects: Effect[];
  source: "homebrew";
  scope: "personal" | "shared";
  owner_id: string;
  version: number;
  created_at: string;
  is_retired: boolean;
}

export type HomebrewBackgroundMutationResult = {
  status: "idle" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type HomebrewBackgroundMutationResponse =
  | HomebrewBackgroundRecord
  | HomebrewBackgroundMutationResult;

export interface HomebrewBackgroundCampaignOption {
  id: string;
  name: string;
  shared: boolean;
  eligible: boolean;
}

export interface OwnedHomebrewBackgroundSummary
  extends HomebrewBackgroundRecord {
  sharedCampaignCount: number;
}

export interface HomebrewBackgroundCampaignAccess {
  campaigns: HomebrewBackgroundCampaignOption[];
  sharedCampaignCount: number;
}

export interface HomebrewBackgroundShareSuccess {
  contentId: string;
  version: number;
  scope: "personal" | "shared";
  sharedCampaignCount: number;
}

export type HomebrewBackgroundShareMutationResponse =
  | HomebrewBackgroundShareSuccess
  | HomebrewBackgroundMutationResult;

const rowEnvelopeSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string().uuid(),
  content_type: z.literal("background"),
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

const campaignAccessRpcRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  shared: z.boolean(),
  eligible: z.boolean(),
});

const shareRpcRowSchema = z.object({
  content_id: z.string().uuid(),
  version: z.number().int().positive(),
  scope: z.enum(["personal", "shared"]),
  shared_campaign_count: z.number().int().nonnegative(),
});

const contentShareSchema = z.object({
  content_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
});

function parseRecord(value: unknown): HomebrewBackgroundRecord {
  const envelope = rowEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new Error("The database returned an invalid homebrew background row.");
  }

  const data = backgroundDataSchema.safeParse(envelope.data.data);
  const effects = z.array(effectSchema).safeParse(envelope.data.effects);
  if (!data.success || !effects.success) {
    throw new Error("The database returned invalid homebrew background content.");
  }

  return { ...envelope.data, data: data.data, effects: effects.data };
}

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): HomebrewBackgroundMutationResult {
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
    .replace(/^-+|-+$/g, "") || "homebrew-background";

  // Slugs are immutable content identity. The suffix avoids collisions while
  // keeping every later version of this background under the same identity.
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function validateServerContext(
  supabase: ServerSupabaseClient,
): Promise<
  | { systemId: string }
  | { failure: HomebrewBackgroundMutationResult }
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
      "The background identity conflicted with another save. Please try again.",
    );
  }
  return failure("The background could not be saved. Please try again.");
}

function databaseShareFailure(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  if (
    error?.code === "40001"
    || (error?.code === "P0001" && /(stale|version|conflict)/.test(message))
  ) {
    return {
      status: "conflict" as const,
      message:
        "This background changed in another session. Reload it before changing campaign access.",
    };
  }
  return failure("Campaign access could not be updated. Please try again.");
}

function parseShareRpcRow(value: unknown): HomebrewBackgroundShareSuccess {
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
): Promise<HomebrewBackgroundCampaignAccess> {
  const { data, error } = await supabase.rpc(
    "list_owned_content_campaign_access",
    { target_content_id: contentId },
  );
  if (error) throw error;
  const campaigns = z.array(campaignAccessRpcRowSchema).parse(data ?? []);
  return {
    campaigns,
    sharedCampaignCount: campaigns.filter((campaign) => campaign.shared).length,
  };
}

/**
 * The form mapper constructs the only supported payload and derives its
 * effects, but the DAL repeats both schema checks at the trust boundary before
 * the values reach persistence. This also protects future mapper changes.
 */
function validateMappedBackground(value: { data: unknown; effects: unknown }):
  | { data: BackgroundData; effects: Effect[] }
  | { failure: HomebrewBackgroundMutationResult } {
  const data = backgroundDataSchema.safeParse(value.data);
  const effects = z.array(effectSchema).safeParse(value.effects);
  if (!data.success || !effects.success) {
    return {
      failure: failure(
        "The background contains unsupported structured data.",
      ),
    };
  }
  return { data: data.data, effects: effects.data };
}

/** Return every active personal or campaign-shared background the owner may edit. */
export async function listOwnedHomebrewBackgrounds(): Promise<
  OwnedHomebrewBackgroundSummary[]
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
    .eq("content_type", "background")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  const backgrounds = (data ?? []).map(parseRecord);
  const sharedIds = backgrounds
    .filter((background) => background.scope === "shared")
    .map((background) => background.id);
  if (sharedIds.length === 0) {
    return backgrounds.map((background) => ({
      ...background,
      sharedCampaignCount: 0,
    }));
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
  return backgrounds.map((background) => ({
    ...background,
    sharedCampaignCount: counts.get(background.id) ?? 0,
  }));
}

/** Return a background only when it is still active and owned by caller. */
export async function getOwnedHomebrewBackground(
  id: string,
): Promise<HomebrewBackgroundRecord | null> {
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
    .eq("content_type", "background")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function getHomebrewBackgroundCampaignAccess(
  id: string,
): Promise<HomebrewBackgroundCampaignAccess> {
  const { supabase } = await requireAuthenticatedSession();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) {
    throw new Error("The background identifier is invalid.");
  }
  return loadOwnedCampaignAccess(supabase, parsedId.data);
}

export async function setHomebrewBackgroundCampaignShare(
  contentId: string,
  campaignId: string,
  enabled: boolean,
  expectedVersion: number,
): Promise<HomebrewBackgroundShareMutationResponse> {
  const session = await authenticatedSession();
  if (!session) return failure("Sign in before changing campaign access.");

  const input = z.object({
    contentId: z.string().uuid(),
    campaignId: z.string().uuid(),
    enabled: z.boolean(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ contentId, campaignId, enabled, expectedVersion });
  if (!input.success) {
    return failure("The background, campaign, or version is invalid.");
  }

  const { data, error } = await session.supabase.rpc(
    "set_content_campaign_share",
    {
      target_content_id: input.data.contentId,
      target_campaign_id: input.data.campaignId,
      enabled: input.data.enabled,
      expected_version: input.data.expectedVersion,
    },
  );
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

export async function createHomebrewBackgroundRecord(
  formData: FormData,
): Promise<HomebrewBackgroundMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before creating a homebrew background.");
  }

  const parsed = mapHomebrewBackgroundFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedBackground(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .insert({
      system_id: context.systemId,
      content_type: "background",
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      data: content.data as unknown as Json,
      effects: content.effects as unknown as Json,
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
    return failure("The background could not be saved. Please try again.");
  }
}

export async function updateHomebrewBackgroundRecord(
  id: string,
  expectedVersion: number,
  formData: FormData,
): Promise<HomebrewBackgroundMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before updating a homebrew background.");
  }

  const identity = z.object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ id, expectedVersion });
  if (!identity.success) {
    return failure("The background identifier or version is invalid.");
  }

  const parsed = mapHomebrewBackgroundFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedBackground(parsed.data);
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
    .eq("content_type", "background")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .eq("version", identity.data.expectedVersion)
    .select(HOMEBREW_SELECT)
    .maybeSingle();

  if (error) return databaseMutationFailure(error);
  if (data) {
    try {
      return parseRecord(data);
    } catch {
      return failure("The background could not be saved. Please try again.");
    }
  }

  const { data: current, error: lookupError } = await session.supabase
    .from("content_definitions")
    .select("id, version")
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "background")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .maybeSingle();

  if (lookupError) return databaseMutationFailure(lookupError);
  if (current) {
    return {
      status: "conflict",
      message:
        "This background changed in another session. Reload it before saving again.",
    };
  }

  return failure("This homebrew background could not be found.");
}
