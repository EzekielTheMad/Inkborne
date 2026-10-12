import type { CharacterState } from "@/lib/types/character";
import type { RollResult } from "@/lib/dice/types";
declare global {
  interface Window {
    __subclassKind: "third" | "prepared" | "inactive" | "missing" | "grant-full" | "grant-half" | "grant-pact" | "viewer" | "multiclass";
    __subclassStored: CharacterState;
    __subclassWrites: Partial<CharacterState>[];
    __subclassRolls: RollResult[];
    __subclassUpdates: string[];
  }
}
/** Offline conditional model only, not a live session or source-authority proof. */
export async function updateCharacterState(_id: string, patch: Partial<CharacterState>, expected?: CharacterState) {
  if (expected && JSON.stringify(expected) !== JSON.stringify(window.__subclassStored)) throw new Error("Fixture conflict");
  window.__subclassWrites.push(patch); window.__subclassStored = { ...window.__subclassStored, ...patch };
  return window.__subclassStored;
}
export async function updateCharacterSpell(id: string) { window.__subclassUpdates.push(id); }
export async function insertRoll(_id: string, result: RollResult) { window.__subclassRolls.push(result); }
function unavailable(): never { throw new Error("Live provider access is disabled in this offline fixture"); }
export const createClient = unavailable;
export const addInventoryItem = unavailable, updateInventoryItem = unavailable, removeInventoryItem = unavailable, unequipAllArmor = unavailable;
export const addCharacterSpell = unavailable, removeCharacterSpell = unavailable, searchSpells = unavailable;
