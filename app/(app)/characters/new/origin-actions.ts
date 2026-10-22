"use server";

import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { creationUUID, parseCreationIntent, sameCreationIntent, type CreationUIResult } from "@/lib/character/pending-creation-schema";
import { createClassOriginCharacterForAccount, resolveClassOriginCreationForAccount } from "@/lib/supabase/character-command-server";

// Both endpoints accept only the original intent. Authentication, current actor
// and the transport context are derived inside the production server helper.
async function run(expectedAccountId: unknown, input: unknown, recovery: boolean): Promise<CreationUIResult> {
  if (!characterCreationUIEnabled()) return { status: "disabled" };
  try {
    const intent = parseCreationIntent(input);
    const account = creationUUID.safeParse(expectedAccountId);
    if (!intent || !account.success) return { status: "invalid" };
    const result = recovery
      ? await resolveClassOriginCreationForAccount(account.data, intent.operation_id)
      : await createClassOriginCharacterForAccount(account.data, intent);
    if (result.status !== "applied" && result.status !== "recorded") {
      return { status: result.status };
    }
    const receipt = result.receipt;
    const canonical = parseCreationIntent(receipt.canonical_intent);
    if (receipt.receipt_kind !== "bootstrap_new" || receipt.operation_id !== intent.operation_id
      || !canonical || !sameCreationIntent(canonical, intent)) return { status: "intent_conflict" };
    return { status: "confirmed", account_id: receipt.verified_actor_id,
      operation_id: receipt.operation_id, character_id: receipt.target_character_id };
  } catch { return { status: "unavailable" }; }
}

export async function submitOriginCreation(expectedAccountId: unknown, input: unknown): Promise<CreationUIResult> {
  return run(expectedAccountId, input, false);
}

export async function checkOriginCreation(expectedAccountId: unknown, input: unknown): Promise<CreationUIResult> {
  return run(expectedAccountId, input, true);
}
