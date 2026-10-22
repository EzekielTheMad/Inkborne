"use server";

import { randomUUID } from "node:crypto";
import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { boundedClassRoleJson } from "@/lib/character/class-role-effects-schema";
import { builderStepInputSchema, builderStepResponseSchema, type BuilderStepCommand, type BuilderStepSaved } from "@/lib/builder/builder-step-command";
import { equalEquipmentIntent } from "@/lib/builder/starting-equipment-contract";
import { createClient } from "@/lib/supabase/server";
import type { CharacterChoices } from "@/lib/types/character";

/** One domain patch, merged by the locked database writer; never a whole choices replacement. */
export async function saveBuilderStep(expectedAccountId: string, characterId: string,
  command: BuilderStepCommand, fields: Record<string, unknown>): Promise<BuilderStepSaved> {
  const input = builderStepInputSchema.safeParse({ command, fields });
  if (!characterCreationUIEnabled() || !input.success
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(characterId)) {
    throw Error("This selection could not be saved. Reload before trying again.");
  }
  const verified = await resolveCharacterCommandContext();
  if (verified.status !== "token_verified" || verified.context.actor_id !== expectedAccountId) {
    throw Error("Your sign-in changed. Sign in and reload before saving.");
  }
  const original = { contract_version: 1, operation_id: randomUUID(), character_id: characterId, ...input.data };
  const client = await createClient();
  const args = { p_context: { ...verified.context }, p_request: original };
  // This client carries the actual user's cookies. SQL independently compares
  // the signed JWT actor/session/deadline before taking the shared writer lock.
  let response: unknown;
  const sent = await client.rpc("character_builder_command_v1", args).then(result => result, () => null);
  if (!sent || sent.error) {
    // Controlled SQL categories only: never log a request, JWT, Auth response,
    // database details/hint or an arbitrary provider error message.
    const message = sent?.error?.message;
    console.warn("Builder step was not confirmed", { code: sent?.error?.code ?? "transport",
      reason: typeof message === "string" && (/^(builder|first_class|character_command|protected_character)_[a-z_]+$/.test(message)
        || /^permission denied for (schema|table|function|sequence) [a-z0-9_.]+$/.test(message))
        ? message : "withheld" });
    // Resolve the same operation after an uncertain response; never resend a
    // mutation with changed expectations or fall back to direct table writes.
    const resolved = await client.rpc("character_builder_command_v1", { p_context: args.p_context,
      p_request: { contract_version: 1, command: "resolve_builder", operation_id: original.operation_id, character_id: characterId } })
      .then(result => result, () => null);
    response = !resolved || resolved.error ? null : resolved.data;
  } else response = sent.data;
  const parsed = boundedClassRoleJson(response) ? builderStepResponseSchema.safeParse(response) : null;
  if (!parsed?.success || parsed.data.status === "absent") {
    throw Error("This selection could not be confirmed. Reload its saved values before trying again.");
  }
  const receipt = parsed.data.receipt;
  if (receipt.operation_id !== original.operation_id || receipt.character_id !== characterId
    || receipt.actor_id !== expectedAccountId || receipt.command !== command || !equalEquipmentIntent(receipt.fields, input.data.fields)) {
    throw Error("This selection could not be confirmed. Reload its saved values before trying again.");
  }
  return { choices: receipt.saved_choices as CharacterChoices, scores: receipt.saved_scores };
}
