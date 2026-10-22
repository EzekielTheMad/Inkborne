import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";
import { classOriginReceiptSchema, type ClassOriginReceipt } from "@/lib/character/class-origin-command-schema";
import { boundedClassRoleJson } from "@/lib/character/class-role-effects-schema";
import type { Json } from "@/lib/supabase/database.types";

// This is a staged transport contract, not a claim that the hosted generated
// Database type or an installed RPC exposes this endpoint. No app caller yet.
type CreationBridgeDatabase = {
  public: {
    Tables: Record<string, never>; Views: Record<string, never>;
    Functions: { character_creation_command_v1: { Args: { p_context: Json; p_request: Json }; Returns: Json } };
    Enums: Record<string, never>; CompositeTypes: Record<string, never>;
  };
};
const uuid = z.string().regex(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/);
const creationIntent = z.strictObject({
  contract_version: z.literal(1), operation_id: uuid, command: z.literal("create_character"),
  fields: z.strictObject({ name: z.string().min(1).max(100).refine(value => value === value.trim()),
    system_id: uuid, campaign_id: z.null() }),
});
const response = z.union([
  z.strictObject({ status: z.enum(["applied", "recorded"]), receipt: classOriginReceiptSchema }),
  z.strictObject({ status: z.enum(["invalid", "unsupported", "intent_conflict", "absent"]) }),
]);
const unavailable = Object.freeze({ status: "unavailable", reason: "character_creation_unavailable" } as const);
type Request = z.infer<typeof creationIntent> | { contract_version: 1; command: "resolve_creation"; operation_id: string };
export type CharacterCreationCommandResult =
  | { status: "applied" | "recorded"; receipt: ClassOriginReceipt }
  | { status: "invalid" | "unsupported" | "intent_conflict" | "absent" }
  | typeof unavailable;

function bounded(value: unknown, maximum: number): boolean {
  return boundedClassRoleJson(value) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= maximum;
}

async function send(request: Request): Promise<CharacterCreationCommandResult> {
  try {
    // Caller input never contains context, actor, session, expiry or a JWT.
    // The service credential remains a trusted server boundary: its holders
    // can forge context; PostgreSQL does not establish SDK verification.
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const verified = await resolveCharacterCommandContext();
    if (verified.status !== "token_verified") return unavailable;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || url !== configuredUrl || !key || key.trim().length === 0) return unavailable;
    const client = createClient<CreationBridgeDatabase>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Fresh cookie-free service client. Never set user Authorization headers,
    // auth.uid(), request GUCs or any caller-supplied identity.
    const { data, error } = await client.rpc("character_creation_command_v1", {
      p_context: { ...verified.context }, p_request: request,
    });
    if (error || !bounded(data, 65536)) return unavailable;
    const parsed = response.safeParse(data);
    if (!parsed.success) return unavailable;
    if (parsed.data.status === "absent" && request.command !== "resolve_creation") return unavailable;
    if ((parsed.data.status === "intent_conflict" || parsed.data.status === "unsupported")
      && request.command !== "create_character") return unavailable;
    if (parsed.data.status === "applied" && request.command !== "create_character") return unavailable;
    if (parsed.data.status === "recorded" || parsed.data.status === "applied") {
      // The shared receipt schema trims a creation name. Independently parse
      // the RAW canonical intent with this nontransforming finite schema so
      // normalization cannot turn a mismatched stored receipt into a match.
      const raw = data as { receipt: { canonical_intent: unknown } };
      const canonical = creationIntent.safeParse(raw.receipt.canonical_intent);
      if (!canonical.success || JSON.stringify(canonical.data) !== JSON.stringify(parsed.data.receipt.canonical_intent)) return unavailable;
      const receipt = parsed.data.receipt;
      if (receipt.receipt_kind !== "bootstrap_new" || receipt.canonical_intent.command !== "create_character"
        || receipt.operation_id !== request.operation_id || receipt.verified_actor_id !== verified.context.actor_id
        || receipt.canonical_intent.fields.campaign_id !== null
        || (request.command === "create_character" && JSON.stringify(receipt.canonical_intent) !== JSON.stringify(request))) return unavailable;
    }
    return parsed.data;
  } catch {
    // Transport errors may follow an accepted transaction. Neither this result
    // nor `absent` permits cancellation, fallback INSERT or a new operation ID.
    return unavailable;
  }
}

/** Existing SQL Auth/NEW denials remain in force. No legacy save fallback. */
export async function createClassOriginCharacter(input: unknown): Promise<CharacterCreationCommandResult> {
  try {
    if (!bounded(input, 32768)) return { status: "invalid" };
    const parsed = creationIntent.safeParse(input);
    return parsed.success ? send(parsed.data) : { status: "invalid" };
  } catch { return { status: "invalid" }; }
}

/** Resolve the SAME operation after an uncertain response. Absence is a
 * recovery observation, not permission to retry under a different identity. */
export async function resolveClassOriginCreation(operationId: unknown): Promise<CharacterCreationCommandResult> {
  const parsed = uuid.safeParse(operationId);
  return parsed.success ? send({ contract_version: 1, command: "resolve_creation", operation_id: parsed.data }) : { status: "invalid" };
}
