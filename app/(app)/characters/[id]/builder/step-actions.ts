"use server";

import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { boundedClassRoleJson } from "@/lib/character/class-role-effects-schema";
import { builderStepResponseSchema, parseBuilderStepIntent,
  type BuilderStepCommand, type BuilderStepResponse, type BuilderStepSaved } from "@/lib/builder/builder-step-command";
import { equalEquipmentIntent } from "@/lib/builder/starting-equipment-contract";
import { createClient } from "@/lib/supabase/server";
import type { CharacterChoices } from "@/lib/types/character";

async function run(expectedAccountId: string, input: unknown, recovery: boolean): Promise<BuilderStepResponse> {
  const original = parseBuilderStepIntent(input);
  if (!characterCreationUIEnabled() || !original) {
    throw Error("This selection could not be saved. Reload before trying again.");
  }
  const verified = await resolveCharacterCommandContext();
  if (verified.status !== "token_verified" || verified.context.actor_id !== expectedAccountId) {
    throw Error("Your sign-in changed. Sign in and reload before saving.");
  }
  const client = await createClient();
  const resolveRequest = { contract_version: 1, command: "resolve_builder",
    operation_id: original.operation_id, character_id: original.character_id };
  // The user's actual cookies are compared independently to the context under
  // native ownership/session locks. A receipt lookup never performs a save.
  const args = { p_context: { ...verified.context }, p_request: recovery ? resolveRequest : original };
  const sent = await client.rpc("character_builder_command_v1", args).then(result => result, () => null);
  let response: unknown = sent && !sent.error ? sent.data : null;
  if ((!sent || sent.error) && !recovery) {
    // Resolve only this retained operation; no new UUID or changed request.
    const resolved = await client.rpc("character_builder_command_v1", {
      p_context: args.p_context, p_request: resolveRequest,
    }).then(result => result, () => null);
    response = resolved && !resolved.error ? resolved.data : null;
  }
  const parsed = boundedClassRoleJson(response) ? builderStepResponseSchema.safeParse(response) : null;
  if (!parsed?.success) {
    throw Error("This selection could not be confirmed. Check or retry the original save.");
  }
  if (parsed.data.status === "absent") return parsed.data;
  const receipt = parsed.data.receipt;
  if (receipt.operation_id !== original.operation_id || receipt.character_id !== original.character_id
    || receipt.actor_id !== expectedAccountId || receipt.command !== original.command
    || !equalEquipmentIntent(receipt.fields, original.fields)) {
    throw Error("This selection could not be confirmed. Check or retry the original save.");
  }
  return parsed.data;
}

export async function submitBuilderStep(expectedAccountId: string, input: unknown): Promise<BuilderStepResponse> {
  return run(expectedAccountId, input, false);
}

export async function checkBuilderStep(expectedAccountId: string, input: unknown): Promise<BuilderStepResponse> {
  return run(expectedAccountId, input, true);
}

/** Bound page adapter. Ordinary clients use the shared retained-intent boundary. */
export async function saveBuilderStep(expectedAccountId: string, characterId: string,
  command: BuilderStepCommand, fields: Record<string, unknown>, operationId?: string): Promise<BuilderStepSaved> {
  const result = await submitBuilderStep(expectedAccountId, {
    contract_version: 1, operation_id: operationId, character_id: characterId, command, fields,
  });
  if (result.status === "absent") throw Error("This selection could not be confirmed. Check or retry the original save.");
  return { choices: result.receipt.saved_choices as CharacterChoices,
    scores: result.receipt.saved_scores, action_revision: result.receipt.action_revision };
}
