import { createClient } from "@/lib/supabase/client";
import type { RollResult } from "@/lib/dice/types";
import type { RollLogEntry } from "@/lib/types/rolls";

/**
 * Persists one roll to the append-only `character_rolls` log.
 *
 * Fire-and-forget by contract: a failed insert logs to the console and never
 * throws — persistence must never block the roll toast (design §3.5).
 * `user_id` is filled server-side (DEFAULT auth.uid()).
 */
export async function insertRoll(
  characterId: string,
  result: RollResult,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("character_rolls").insert({
    character_id: characterId,
    kind: result.request.kind,
    label: result.request.label,
    expression: result.request.expression,
    result,
    total: result.total,
    rolled_at: result.rolled_at,
  });

  if (error) {
    console.error("[insertRoll] Error:", error.message);
  }
}

/** Fetches the most recent rolls for a character, newest first. */
export async function getRecentRolls(
  characterId: string,
  limit = 50,
): Promise<RollLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("character_rolls")
    .select("*")
    .eq("character_id", characterId)
    .order("rolled_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getRecentRolls] Error:", error.message);
    return [];
  }
  return (data ?? []) as RollLogEntry[];
}
