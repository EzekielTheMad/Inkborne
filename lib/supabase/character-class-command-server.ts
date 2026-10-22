import "server-only";
import { createClient } from "@supabase/supabase-js";
import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";
import { firstClassCommandResponseSchema, parseFirstClassIntent, sameFirstClassIntent,
  type FirstClassCommandResult, type FirstClassIntent } from "@/lib/character/first-class-command-schema";
import { boundedClassRoleJson } from "@/lib/character/class-role-effects-schema";
import type { Json } from "@/lib/supabase/database.types";

// Staged transport declarations, not generated hosted types or proof of an installed RPC.
type ClassCommandDatabase = {
  public: {
    Tables: Record<string, never>; Views: Record<string, never>;
    Functions: { character_class_command_v1: { Args: { p_context: Json; p_request: Json }; Returns: Json } };
    Enums: Record<string, never>; CompositeTypes: Record<string, never>;
  };
};
const accountUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const unavailable = Object.freeze({ status: "unavailable", reason: "character_class_unavailable" } as const);

async function send(expectedAccountId: string, original: FirstClassIntent, resolve: boolean): Promise<FirstClassCommandResult> {
  try {
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const verified = await resolveCharacterCommandContext();
    // Page identity is only a consistency check. The no-argument same-token
    // verifier supplies the sole actor/session context, never caller arguments.
    if (verified.status !== "token_verified" || verified.context.actor_id !== expectedAccountId) return unavailable;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || url !== configuredUrl || !key || key.trim().length === 0) return unavailable;
    const client = createClient<ClassCommandDatabase>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // Fresh server-only, cookie-free client; no user Authorization override,
    // auth.uid/GUC/session setting, direct-table fallback or automatic retry.
    // Service-credential holders remain trusted: SQL does not verify this JWT.
    const request = resolve ? { contract_version: 1, command: "resolve_class",
      character_id: original.character_id, operation_id: original.operation_id } : original;
    const { data, error } = await client.rpc("character_class_command_v1", {
      p_context: { ...verified.context }, p_request: request,
    });
    if (error) {
      // Only this exact controlled producer refusal is a definite conflict.
      // All other SQL, provider and transport errors retain uncertain recovery.
      return !resolve && error.code === "23505" && error.message === "operation_intent_conflict"
        ? { status: "intent_conflict" } : unavailable;
    }
    if (!boundedClassRoleJson(data) || new TextEncoder().encode(JSON.stringify(data)).byteLength > 65536) return unavailable;
    const parsed = firstClassCommandResponseSchema.safeParse(data);
    if (!parsed.success) return unavailable;
    const result = parsed.data;
    if (result.status === "invalid") return result;
    if (result.status === "absent") return resolve ? result : unavailable;
    if (!("receipt" in result)) return unavailable;
    if (resolve ? result.status !== "recorded" : result.status !== "applied" && result.status !== "replayed") return unavailable;
    if (result.receipt.verified_actor_id !== verified.context.actor_id
      || result.receipt.target_character_id !== original.character_id
      || result.receipt.operation_id !== original.operation_id
      || !sameFirstClassIntent(result.receipt.canonical_intent, original)) return unavailable;
    return result;
  } catch {
    // A lost response can follow COMMIT. Never discard the original operation,
    // synthesize an accepted result, call legacy writers or retry here.
    return unavailable;
  }
}

export async function addFirstClassForAccount(expectedAccountId: unknown, input: unknown): Promise<FirstClassCommandResult> {
  const intent = parseFirstClassIntent(input);
  return typeof expectedAccountId === "string" && accountUuid.test(expectedAccountId) && intent
    ? send(expectedAccountId, intent, false) : { status: "invalid" };
}

/** Recovery requires the complete original intent locally. Only its original
 * target and operation are sent to SQL, then the full saved receipt must match. */
export async function resolveFirstClassForAccount(expectedAccountId: unknown, input: unknown): Promise<FirstClassCommandResult> {
  const intent = parseFirstClassIntent(input);
  return typeof expectedAccountId === "string" && accountUuid.test(expectedAccountId) && intent
    ? send(expectedAccountId, intent, true) : { status: "invalid" };
}
