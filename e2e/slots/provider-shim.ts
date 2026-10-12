import type { CharacterState } from "@/lib/types/character";
declare global { interface Window { __slotKind: "half" | "pact" | "unavailable" | "noncaster"; __slotStored: CharacterState; __slotWrites: Partial<CharacterState>[] } }
/** In-memory conditional persistence only; no server, session or database. */
export async function updateCharacterState(_id: string, patch: Partial<CharacterState>, expected?: CharacterState) {
  if (expected && JSON.stringify(expected) !== JSON.stringify(window.__slotStored)) throw new Error("Fixture conflict");
  window.__slotWrites.push(patch);
  window.__slotStored = { ...window.__slotStored, ...patch };
  return window.__slotStored;
}
function unavailable(): never { throw new Error("Provider access is disabled in this offline fixture"); }
export const createClient = unavailable;
export const addInventoryItem = unavailable, updateInventoryItem = unavailable, removeInventoryItem = unavailable, unequipAllArmor = unavailable;
export const addCharacterSpell = unavailable, updateCharacterSpell = unavailable, removeCharacterSpell = unavailable, searchSpells = unavailable, insertRoll = unavailable;
