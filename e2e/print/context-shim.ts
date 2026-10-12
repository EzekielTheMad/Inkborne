import { printFixture } from "./fixtures";
import { canonicalWeaponPrintFixture } from "./canonical-weapons";
import { executeRoll } from "@/lib/dice/roller";
import type { RollRequest, RollResult } from "@/lib/dice/types";
declare global { interface Window { __printFixture: "martial" | "caster" | "long"; __canonicalWeaponUi?: boolean; __weaponRolls?: RollRequest[]; __weaponResults?: RollResult[] } }
const ctx = () => window.__canonicalWeaponUi ? canonicalWeaponPrintFixture() : printFixture(window.__printFixture);
export const useCharacter = ctx;
export const useCharacterState = ctx;
export const useInventory = ctx;
export const useSpells = ctx;
export const useRest = ctx;
export const useResources = ctx;
export const useRolls = () => ({ ...ctx(), roll: (request: RollRequest) => {
  // Deterministic fixture RNG exercises the real parser/crit/roller pipeline.
  const result = executeRoll(request, () => .999);
  (window.__weaponRolls ??= []).push(request);
  (window.__weaponResults ??= []).push(result);
  return result;
} });
export const useActiveEffects = () => ({ activeEffects: [] });
export const useConcentration = () => ({ pendingCheck: null });
