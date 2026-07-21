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
  scope: "personal" | "shared";
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

export interface HomebrewFeatCampaignOption {
  id: string;
  name: string;
  shared: boolean;
  eligible: boolean;
}

export interface OwnedHomebrewFeatSummary extends HomebrewFeatRecord {
  sharedCampaignCount: number;
}

export interface HomebrewFeatCampaignAccess {
  campaigns: HomebrewFeatCampaignOption[];
  sharedCampaignCount: number;
}

export interface HomebrewFeatShareSuccess {
  contentId: string;
  version: number;
  scope: "personal" | "shared";
  sharedCampaignCount: number;
}

export type HomebrewFeatShareMutationResponse =
  | HomebrewFeatShareSuccess
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

function databaseShareFailure(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  if (
    error?.code === "40001"
    || (error?.code === "P0001" && /(stale|version|conflict)/.test(message))
  ) {
    return {
      status: "conflict" as const,
      message: "This feat changed in another session. Reload it before changing campaign access.",
    };
  }
  return failure("Campaign access could not be updated. Please try again.");
}

function parseShareRpcRow(value: unknown): HomebrewFeatShareSuccess {
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
): Promise<HomebrewFeatCampaignAccess> {
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

/** Return every active personal or campaign-shared feat the owner may edit. */
export async function listOwnedHomebrewFeats(): Promise<OwnedHomebrewFeatSummary[]> {
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
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  const feats = (data ?? []).map(parseRecord);
  const sharedIds = feats
    .filter((feat) => feat.scope === "shared")
    .map((feat) => feat.id);
  if (sharedIds.length === 0) {
    return feats.map((feat) => ({ ...feat, sharedCampaignCount: 0 }));
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
  return feats.map((feat) => ({
    ...feat,
    sharedCampaignCount: counts.get(feat.id) ?? 0,
  }));
}

/** Return a feat only when it is still active and owned by caller. */
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
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function getOwnedHomebrewFeatCampaignAccess(
  id: string,
): Promise<HomebrewFeatCampaignAccess> {
  const { supabase } = await requireAuthenticatedSession();
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) throw new Error("The feat identifier is invalid.");
  return loadOwnedCampaignAccess(supabase, parsedId.data);
}

export async function setHomebrewFeatCampaignShare(
  contentId: string,
  campaignId: string,
  enabled: boolean,
  expectedVersion: number,
): Promise<HomebrewFeatShareMutationResponse> {
  const session = await authenticatedSession();
  if (!session) return failure("Sign in before changing campaign access.");

  const input = z.object({
    contentId: z.string().uuid(),
    campaignId: z.string().uuid(),
    enabled: z.boolean(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ contentId, campaignId, enabled, expectedVersion });
  if (!input.success) return failure("The feat, campaign, or version is invalid.");

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
    .in("scope", ["personal", "shared"])
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
