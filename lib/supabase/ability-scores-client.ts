import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

export type AbilityMethod = "standard_array" | "point_buy" | "manual";
export interface AbilityScoreSnapshot {
  method: AbilityMethod | null;
  scores: Record<string, number>;
}
export interface AbilityScoreDraft extends AbilityScoreSnapshot {
  method: AbilityMethod;
}

export class AbilityScoreConflictError extends Error {
  constructor() {
    super("Ability scores changed in another editor. Reload the saved scores before editing again.");
    this.name = "AbilityScoreConflictError";
  }
}

const savedSchema = z.object({
  saved_method: z.enum(["standard_array", "point_buy", "manual"]),
  saved_scores: z.record(z.string(), z.number().int().min(1).max(30)),
});

/** An ability-only, owner-authorized compare-and-swap. Never resend choices. */
export async function saveCharacterAbilities(
  characterId: string,
  next: AbilityScoreDraft,
  expected: AbilityScoreSnapshot,
): Promise<AbilityScoreDraft> {
  const { data, error } = await createClient().rpc("save_character_abilities", {
    target_character_id: characterId,
    ability_method: next.method,
    ability_scores: next.scores,
    expected_method: expected.method,
    expected_scores: expected.scores,
  });
  if (error) {
    if (error.code === "P0001" && error.message === "ABILITY_SCORES_CHANGED") {
      throw new AbilityScoreConflictError();
    }
    throw new Error(error.message);
  }
  const parsed = savedSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) throw new Error("The saved ability-score response was invalid.");
  return { method: parsed.data.saved_method, scores: parsed.data.saved_scores };
}
