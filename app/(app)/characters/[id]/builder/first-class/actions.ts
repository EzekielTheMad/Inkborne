"use server";

import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { parseFirstClassIntent, sameFirstClassIntent, type FirstClassUIResult } from "@/lib/character/first-class-command-schema";
import { creationUUID } from "@/lib/character/pending-creation-schema";
import { addFirstClassForAccount, resolveFirstClassForAccount } from "@/lib/supabase/character-class-command-server";

async function run(expectedAccountId: unknown, input: unknown, recovery: boolean): Promise<FirstClassUIResult> {
  if (!characterCreationUIEnabled()) return { status: "disabled" };
  try {
    const account = creationUUID.safeParse(expectedAccountId), intent = parseFirstClassIntent(input);
    if (!account.success || !intent) return { status: "invalid" };
    const result = recovery ? await resolveFirstClassForAccount(account.data, intent)
      : await addFirstClassForAccount(account.data, intent);
    if (result.status !== "applied" && result.status !== "replayed" && result.status !== "recorded") {
      return { status: result.status };
    }
    const receipt = result.receipt;
    if (receipt.verified_actor_id !== account.data || receipt.target_character_id !== intent.character_id
      || receipt.operation_id !== intent.operation_id || !sameFirstClassIntent(receipt.canonical_intent, intent)) {
      return { status: "unavailable" };
    }
    return { status: "confirmed", account_id: receipt.verified_actor_id,
      character_id: receipt.target_character_id, operation_id: receipt.operation_id };
  } catch { return { status: "unavailable" }; }
}

export async function submitFirstClass(expectedAccountId: unknown, input: unknown): Promise<FirstClassUIResult> {
  return run(expectedAccountId, input, false);
}

export async function checkFirstClass(expectedAccountId: unknown, input: unknown): Promise<FirstClassUIResult> {
  return run(expectedAccountId, input, true);
}
