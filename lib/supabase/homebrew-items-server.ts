import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  mapHomebrewItemFormData,
  type HomebrewItemFormValue,
} from "@/lib/homebrew/item-form";
import {
  itemDataSchema,
  type ItemData,
} from "@/lib/schemas/content-types/item";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const HOMEBREW_SELECT =
  "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface HomebrewItemRecord {
  id: string;
  system_id: string;
  content_type: "item";
  slug: string;
  name: string;
  data: ItemData;
  effects: unknown[];
  source: "homebrew";
  scope: "personal" | "shared";
  owner_id: string;
  version: number;
  created_at: string;
  is_retired: boolean;
}

export type HomebrewItemMutationResult = {
  status: "idle" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type HomebrewItemMutationResponse =
  | HomebrewItemRecord
  | HomebrewItemMutationResult;

const rowEnvelopeSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string().uuid(),
  content_type: z.literal("item"),
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

function parseRecord(value: unknown): HomebrewItemRecord {
  const envelope = rowEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new Error("The database returned an invalid homebrew item row.");
  }

  const data = itemDataSchema.safeParse(envelope.data.data);
  if (!data.success) {
    throw new Error("The database returned invalid homebrew item data.");
  }

  return { ...envelope.data, data: data.data };
}

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): HomebrewItemMutationResult {
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
    .replace(/^-+|-+$/g, "") || "homebrew-item";

  return `${base}-${randomUUID().slice(0, 8)}`;
}

function validateMappedItem(value: HomebrewItemFormValue):
  | { data: ItemData }
  | { failure: HomebrewItemMutationResult } {
  const data = itemDataSchema.safeParse(value.data);
  if (!data.success) {
    return {
      failure: failure("The item contains unsupported structured data."),
    };
  }
  return { data: data.data };
}

async function validateServerContext(
  supabase: ServerSupabaseClient,
): Promise<
  | { systemId: string }
  | { failure: HomebrewItemMutationResult }
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
      "The item identity conflicted with another save. Please try again.",
    );
  }
  return failure("The item could not be saved. Please try again.");
}

export async function listOwnedHomebrewItems(): Promise<
  HomebrewItemRecord[]
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
    .eq("content_type", "item")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .order("name");

  if (error) throw error;
  return (data ?? []).map(parseRecord);
}

export async function getOwnedHomebrewItem(
  id: string,
): Promise<HomebrewItemRecord | null> {
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
    .eq("content_type", "item")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .maybeSingle();

  if (error) throw error;
  return data ? parseRecord(data) : null;
}

export async function createHomebrewItemRecord(
  formData: FormData,
): Promise<HomebrewItemMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before creating a homebrew item.");
  }

  const parsed = mapHomebrewItemFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedItem(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .insert({
      system_id: context.systemId,
      content_type: "item",
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
    const saved = parseRecord(data);
    // Shared reads/edits do not widen the original private-create response.
    if (saved.scope !== "personal") return failure("The item could not be saved. Please try again.");
    return saved;
  } catch {
    return failure("The item could not be saved. Please try again.");
  }
}

export async function updateHomebrewItemRecord(
  id: string,
  expectedVersion: number,
  formData: FormData,
): Promise<HomebrewItemMutationResponse> {
  const session = await authenticatedSession();
  if (!session) {
    return failure("Sign in before updating a homebrew item.");
  }

  const identity = z.object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  }).safeParse({ id, expectedVersion });
  if (!identity.success) {
    return failure("The item identifier or version is invalid.");
  }

  const parsed = mapHomebrewItemFormData(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      parsed.fieldErrors,
    );
  }

  const content = validateMappedItem(parsed.data);
  if ("failure" in content) return content.failure;

  const context = await validateServerContext(session.supabase);
  if ("failure" in context) return context.failure;

  const { data, error } = await session.supabase
    .from("content_definitions")
    .update({
      name: parsed.data.name,
      // All canonical item data fields are authored by the form. Effects are
      // not represented by its controls and must remain untouched on edits.
      data: content.data as unknown as Json,
    })
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "item")
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
      return failure("The item could not be saved. Please try again.");
    }
  }

  const { data: current, error: lookupError } = await session.supabase
    .from("content_definitions")
    .select("id, version")
    .eq("id", identity.data.id)
    .eq("owner_id", session.userId)
    .eq("system_id", context.systemId)
    .eq("source", "homebrew")
    .eq("content_type", "item")
    .in("scope", ["personal", "shared"])
    .eq("is_retired", false)
    .maybeSingle();

  if (lookupError) return databaseMutationFailure(lookupError);
  if (current) {
    return {
      status: "conflict",
      message:
        "This item changed in another session. Reload it before saving again.",
    };
  }

  return failure("This homebrew item could not be found.");
}

export interface HomebrewItemCampaignOption {
  id: string;
  name: string;
  shared: boolean;
  eligible: boolean;
}
export interface HomebrewItemCampaignAccess {
  campaigns: HomebrewItemCampaignOption[];
  sharedCampaignCount: number;
}
export interface HomebrewItemShareSuccess {
  contentId: string;
  version: number;
  scope: "personal" | "shared";
  sharedCampaignCount: number;
}
export interface HomebrewItemShareFailure {
  status: "error" | "conflict" | "uncertain";
  message: string;
}
export type HomebrewItemShareResponse = HomebrewItemShareSuccess | HomebrewItemShareFailure;
const campaignOptionSchema = z.strictObject({ id: z.uuid(), name: z.string().min(1), shared: z.boolean(), eligible: z.boolean() });
const shareVersionSchema = z.number().int().min(1).max(2147483647);
const shareRowSchema = z.strictObject({ content_id: z.uuid(), version: shareVersionSchema,
  scope: z.enum(["personal", "shared"]), shared_campaign_count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });

export async function getHomebrewItemCampaignAccess(id: string): Promise<HomebrewItemCampaignAccess> {
  // The type-independent RPC cannot replace the owned item route boundary.
  const item = await getOwnedHomebrewItem(id);
  if (!item) throw new Error("This owned homebrew item is unavailable.");
  const { supabase } = await requireAuthenticatedSession();
  const { data, error, count } = await supabase.rpc("list_owned_content_campaign_access", { target_content_id: item.id }, { count: "exact" });
  if (error) throw error;
  const campaigns = z.array(campaignOptionSchema).parse(data);
  if (!Number.isSafeInteger(count) || count !== campaigns.length) throw new Error("Complete campaign access projection is unavailable.");
  if (new Set(campaigns.map(campaign => campaign.id)).size !== campaigns.length) throw new Error("Campaign access returned duplicate identifiers.");
  return { campaigns, sharedCampaignCount: campaigns.filter(campaign => campaign.shared).length };
}

function uncertainItemShare(): HomebrewItemShareFailure {
  return { status: "uncertain", message: "Campaign access could not be confirmed. Reload latest access before making another change." };
}
export async function setHomebrewItemCampaignShare(contentId: string, campaignId: string, enabled: boolean, expectedVersion: number): Promise<HomebrewItemShareResponse> {
  const session = await authenticatedSession();
  if (!session) return { status: "error", message: "Sign in before changing campaign access." };
  const input = z.object({ contentId: z.uuid(), campaignId: z.uuid(), enabled: z.boolean(), expectedVersion: shareVersionSchema })
    .safeParse({ contentId, campaignId, enabled, expectedVersion });
  if (!input.success) return { status: "error", message: "The item, campaign, or version is invalid." };
  if (!await resolvePublishedSystem(session.supabase)) return { status: "error", message: "The D&D 5e (2014) system is unavailable." };
  try {
    const { data, error } = await session.supabase.rpc("set_content_campaign_share", {
      target_content_id: input.data.contentId, target_campaign_id: input.data.campaignId,
      enabled: input.data.enabled, expected_version: input.data.expectedVersion,
    });
    if (error) {
      if (error.code === "40001") return { status: "conflict", message: "This item changed in another session. Reload latest access." };
      // These database exceptions roll back the single RPC transaction. Network
      // failures and unclassified responses cannot certify whether it committed.
      if (["42501", "22023", "22003", "23514"].includes(error.code)) return { status: "error", message: "Campaign access was refused. Reload latest access before trying again." };
      return uncertainItemShare();
    }
    const rows = z.array(shareRowSchema).length(1).safeParse(data);
    if (!rows.success) return uncertainItemShare();
    const row = rows.data[0];
    if (row.content_id !== input.data.contentId
      || (row.version !== input.data.expectedVersion && row.version !== input.data.expectedVersion + 1)
      || (row.scope === "shared") !== (row.shared_campaign_count > 0)
      || (input.data.enabled && row.shared_campaign_count === 0)) return uncertainItemShare();
    // Exact written snapshot proof belongs to the staged RPC transaction, not a
    // racy later current-row read (nor an inaccessible final-revoke snapshot).
    return { contentId: row.content_id, version: row.version, scope: row.scope, sharedCampaignCount: row.shared_campaign_count };
  } catch { return uncertainItemShare(); }
}
