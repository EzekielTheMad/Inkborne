import { printFixture } from "./fixtures";
declare global { interface Window { __printFixture: "martial" | "caster" | "long" } }
const ctx = () => printFixture(window.__printFixture);
export const useCharacter = ctx;
export const useCharacterState = ctx;
export const useInventory = ctx;
export const useSpells = ctx;
export const useRest = ctx;
export const useResources = ctx;
export const useRolls = ctx;
export const useConcentration = () => ({ pendingCheck: null });
