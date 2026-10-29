"use client";

import { createClient } from "@/lib/supabase/client";
import { z } from "zod";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import type { CharacterState } from "@/lib/types/character";
import { manualHpRequestSchema, basicSheetResponseSchema, type ManualHpRequest } from "@/lib/character/basic-sheet-command";

/** Native enrolled HP has its own finite admission. Never fall back to CAS. */
export async function updateManualHpState(expectedActor: string, input: ManualHpRequest) {
  const request = manualHpRequestSchema.safeParse(input);
  if (!request.success) throw new CharacterStateReloadError("This HP change is outside the supported manual save. Reload before choosing another action.");
  try {
    const { saveManualCharacterHp } = await import("@/app/(app)/characters/[id]/sheet-actions");
    const result = basicSheetResponseSchema.parse(await saveManualCharacterHp(expectedActor, request.data));
    if (result.status === "applied" || result.status === "unchanged") return result;
    throw new CharacterStateReloadError(result.status === "conflict"
      ? "This character changed in another tab. Reload before choosing a new action. This action was not applied."
      : "The HP save could not be confirmed. Reload and check the result before choosing another action.");
  } catch (error) {
    if (error instanceof CharacterStateReloadError) throw error;
    throw new CharacterStateReloadError("The HP save could not be confirmed. Reload and check the result before choosing another action.");
  }
}

/**
 * Patches the character.state JSONB column with partial updates.
 *
 * Uses the `patch_character_state` Postgres RPC (migration 00031) for an
 * atomic shallow-merge, preserving unrelated top-level state keys. It does
 * not serialize gameplay intent or concurrent replacements of nested maps
 * across clients (e.g., two feature_uses patches can still overwrite uses).
 * Provider HP patches and explicitly guarded casts, slots, resources and rests use the conditional RPC
 * with a raw confirmed snapshot; callers without it retain the legacy contract.
 *
 * Shallow merge semantics: top-level keys in `patch` replace existing keys
 * wholesale. Callers that want to update a nested field (e.g., one entry
 * in feature_uses) must pass the full merged nested object.
 */
export async function updateCharacterState(
  characterId: string,
  patch: Partial<CharacterState>,
  expectedState?: CharacterState,
): Promise<void | CharacterState> {
  const supabase = createClient();
  if (expectedState) {
    try {
      const { data, error } = await supabase.rpc("patch_character_state_if_current", {
        character_id: characterId, expected_state: expectedState, state_patch: patch,
      });
      if (error) throw error;
      const [result] = z.array(z.discriminatedUnion("status", [
        z.object({ status: z.literal("applied"), resulting_state: z.record(z.string(), z.json()) }),
        z.object({ status: z.literal("conflict"), resulting_state: z.record(z.string(), z.json()) }),
        z.object({ status: z.literal("missing"), resulting_state: z.null() }),
      ])).length(1).parse(data);
      if (result.status === "applied") return result.resulting_state as CharacterState;
      throw new CharacterStateReloadError(result.status === "conflict"
        ? "This character changed in another tab. Reload before choosing a new action. This action was not applied."
        : "This character could not be updated. Reload to check access before choosing another action.");
    } catch (error) {
      if (error instanceof CharacterStateReloadError) throw error;
      throw new CharacterStateReloadError("The character save could not be confirmed. Reload and check the result before choosing another action.");
    }
  }
  const { error } = await supabase.rpc("patch_character_state", {
    character_id: characterId,
    state_patch: patch,
  });
  if (error) throw error;
}
