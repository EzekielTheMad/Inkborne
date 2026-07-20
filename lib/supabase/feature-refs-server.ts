import "server-only";

import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ClassChoiceForFeatureSync {
  slug: string;
  level: number;
  subclass?: string;
}

export interface FeatureRefSyncResult {
  inserted: number;
  deleted: number;
}

const featureSyncResultSchema = z
  .array(
    z.object({
      inserted: z.number().int().nonnegative(),
      deleted: z.number().int().nonnegative(),
    }),
  )
  .length(1);

function queryError(operation: string, error: { message?: string }): Error {
  return new Error(
    `[syncClassFeatureRefs] ${operation} failed: ${error.message ?? "unknown database error"}`,
  );
}

/**
 * Atomically reconcile active feature refs from the immutable pinned manifest.
 * The database derives class/subclass levels from persisted character choices,
 * so callers cannot activate future grants by supplying fabricated levels.
 */
export async function syncClassFeatureRefs(
  supabase: ServerSupabaseClient,
  params: {
    characterId: string;
    /** @deprecated Activation is derived from persisted choices in the RPC. */
    classChoices?: ClassChoiceForFeatureSync[];
  },
): Promise<FeatureRefSyncResult> {
  const rpcClient = supabase as unknown as {
    rpc: (
      functionName: "sync_character_feature_refs",
      args: { target_character_id: string },
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc("sync_character_feature_refs", {
    target_character_id: params.characterId,
  });

  if (error) throw queryError("atomic feature reconciliation", error);

  const parsed = featureSyncResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "[syncClassFeatureRefs] refusing an invalid feature-grant reconciliation result",
    );
  }

  return parsed.data[0];
}
