import type { CharacterState } from "@/lib/types/character";
import type { RollResult } from "@/lib/dice/types";
declare global {
  interface Window {
    __castingKind: "int-wizard" | "int-warlock" | "cha-wizard" | "cha-warlock" | "missing" | "viewer";
    __castingStored: CharacterState;
    __castingWrites: Partial<CharacterState>[];
    __castingRolls: RollResult[];
  }
}
/** In-memory conditional persistence only. No server, session or database. */
export async function updateCharacterState(_id: string, patch: Partial<CharacterState>, expected?: CharacterState) {
  if (expected && JSON.stringify(expected) !== JSON.stringify(window.__castingStored)) throw new Error("Fixture conflict");
  window.__castingWrites.push(patch);
  window.__castingStored = { ...window.__castingStored, ...patch };
  return window.__castingStored;
}
export async function insertRoll(_id: string, result: RollResult) { window.__castingRolls.push(result); }
function unavailable(): never { throw new Error("Provider access is disabled in this offline fixture"); }
export const createClient = unavailable;
export const addInventoryItem = unavailable, updateInventoryItem = unavailable, removeInventoryItem = unavailable, unequipAllArmor = unavailable;
export const addCharacterSpell = unavailable, updateCharacterSpell = unavailable, removeCharacterSpell = unavailable;
