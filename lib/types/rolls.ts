/**
 * Types for the persistent roll log (character_rolls, migration 00038).
 */

import type { RollKind, RollResult } from "@/lib/dice/types";

/**
 * One entry of the roll log. Matches a `character_rolls` row (with the
 * `result` jsonb narrowed to `RollResult`); session rolls use the same shape
 * with a client-generated id so optimistic entries and hydrated rows mix
 * freely in one list.
 */
export interface RollLogEntry {
  id: string;
  character_id: string;
  user_id: string;
  kind: RollKind;
  label: string;
  expression: string;
  result: RollResult;
  total: number;
  rolled_at: string;
}
