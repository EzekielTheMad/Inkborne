import type { MaxSlotsByLevel } from "@/lib/types/spells";

/**
 * PHB p164 multiclass spellcaster table.
 * Rows are indexed by (casterLevel - 1). Each row is slots available at levels 1-9.
 * This table is also used for single-class casters (Wizard, Cleric, Druid, Bard, Sorcerer)
 * because their slot progression matches the full-caster column of the multiclass table.
 *
 * Half-casters (Paladin, Ranger) and pact-casters (Warlock) are NOT covered by this table.
 * - Paladin/Ranger contribute half their level (rounded down, no slots at L1) to casterLevel.
 * - Warlock uses its own slot progression from class data.
 */
const MULTICLASS_SLOT_TABLE: ReadonlyArray<readonly number[]> = [
  // L1
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  // L2
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  // L3
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  // L4
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  // L5
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  // L6
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  // L7
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  // L8
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  // L9
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  // L10
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  // L11
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  // L12
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  // L13
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  // L14
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  // L15
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  // L16
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  // L17
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  // L18
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  // L19
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  // L20
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/**
 * Returns the spell slots available at the given caster level (sum of spellcaster class levels
 * after the multiclass weighting: full caster = 1, half caster = 0.5 rounded down with no L1 slots).
 * Returns empty object for level 0 or negative; clamps to level 20 max.
 */
export function getMultiClassSlots(casterLevel: number): MaxSlotsByLevel {
  if (casterLevel <= 0) return {};
  const index = Math.min(casterLevel, 20) - 1;
  const row = MULTICLASS_SLOT_TABLE[index];
  const result: MaxSlotsByLevel = {};
  for (let i = 0; i < 9; i++) {
    const count = row[i];
    if (count > 0) {
      const key = String(i + 1) as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
      result[key] = count;
    }
  }
  return result;
}
