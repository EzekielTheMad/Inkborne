"use server";

import { resolveCharacterCommandContext } from "@/lib/auth/character-command-context";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { boundedClassRoleJson } from "@/lib/character/class-role-effects-schema";
import { builderStepResponseSchema, parseBuilderStepIntent,
  type BuilderStepCommand, type BuilderStepResponse, type BuilderStepSaved } from "@/lib/builder/builder-step-command";
import { equalEquipmentIntent } from "@/lib/builder/starting-equipment-contract";
import { createClient } from "@/lib/supabase/server";
import type { CharacterChoices } from "@/lib/types/character";
import { creationUUID } from "@/lib/character/pending-creation-schema";
import { parseSubclassContentUpdateResponse, subclassContentUpdateRequestSchema,
  type SubclassContentUpdateResponse } from "@/lib/builder/subclass-content-update";

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

/** Read-only review of one supported historical source correction. The native
 * descriptor binds the complete closure, not just the browser's root diff. */
export async function previewSubclassContentUpdate(expectedAccountId: string, characterId: string,
  input: unknown): Promise<SubclassContentUpdateResponse> {
  const unavailable: SubclassContentUpdateResponse = { status: "unavailable", reason: "unavailable" };
  try {
    if (!characterCreationUIEnabled() || !creationUUID.safeParse(expectedAccountId).success
      || !creationUUID.safeParse(characterId).success || !boundedClassRoleJson(input)) return unavailable;
    const request = subclassContentUpdateRequestSchema.safeParse(input);
    if (!request.success) return unavailable;
    const verified = await resolveCharacterCommandContext();
    if (verified.status !== "token_verified" || verified.context.actor_id !== expectedAccountId) return unavailable;
    const client = await createClient();
    const result = await client.rpc("character_builder_subclass_update_preview_v1", {
      p_context: { ...verified.context }, p_character_id: characterId,
      p_subclass_ref_id: request.data.subclass_ref_id, p_target_content_version: request.data.target_content_version,
    });
    if (result.error) return unavailable;
    const parsed = parseSubclassContentUpdateResponse(result.data);
    if (!parsed || parsed.status === "unavailable") return parsed ?? unavailable;
    if (parsed.preview.actor_id !== expectedAccountId || parsed.preview.character_id !== characterId
      || parsed.preview.fields.subclass_ref_id !== request.data.subclass_ref_id
      || parsed.preview.fields.target_content_version !== request.data.target_content_version) return unavailable;
    return parsed;
  } catch { return unavailable; }
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
