import type { CharacterState } from "@/lib/types/character";
import type { ActiveEffect } from "@/lib/types/active-effects";
import type { RollRequest } from "@/lib/dice/types";
import { dropConcentrationEffects } from "@/lib/active-effects/helpers";

// ---------------------------------------------------------------------------
// Concentration lifecycle — pure domain helpers (design §6.6, T7).
//
// The APPLY side of concentration (casting a concentration spell replaces the
// previous one atomically) lives in `applyActiveEffectPatch`. This module owns
// the DROP side: ending concentration — manually, by a failed save, or by
// hitting 0 HP — clears `concentrating_on` AND strips every linked active
// effect in ONE patch, so there is never a window where state disagrees with
// itself. Callers apply the returned patch via `patchState`
// (→ patch_character_state RPC).
// ---------------------------------------------------------------------------

/**
 * Patch that fully ends concentration: `concentrating_on` cleared and all
 * concentration-linked active effects removed. Always a single object so the
 * caller can apply it as ONE atomic `patchState` — or merge it into another
 * patch (the HP tracker merges it into the damage patch when damage drops
 * HP to 0, per RAW's automatic concentration loss on incapacitation).
 */
export function computeConcentrationDropPatch(
  state: CharacterState,
): Partial<CharacterState> {
  const current = (state.active_effects ?? []) as ActiveEffect[];
  return {
    active_effects: dropConcentrationEffects(current),
    concentrating_on: null,
  };
}

/**
 * Concentration-check DC for damage taken while concentrating:
 * `max(10, ⌊damage/2⌋)` (PHB). 14 damage → DC 10; 22 → 11; 47 → 23.
 */
export function concentrationSaveDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

/** A damage-triggered concentration check awaiting player resolution (design D4). */
export interface PendingConcentrationCheck {
  /** Damage taken (drives the DC). */
  damage: number;
  /** `concentrationSaveDc(damage)` — precomputed for display. */
  dc: number;
}

/**
 * Build the CON-save `RollRequest` the concentration prompt executes.
 * Kind `concentration` so the roll toasts/logs/persists like every other
 * roll — and so Bless-style `roll_save` modifiers apply (a concentration
 * check IS a Constitution saving throw).
 */
export function buildConcentrationSaveRequest(
  spellName: string,
  conSaveModifier: number,
  check: PendingConcentrationCheck,
): RollRequest {
  const mod =
    conSaveModifier >= 0 ? `+${conSaveModifier}` : `${conSaveModifier}`;
  return {
    kind: "concentration",
    label: `Concentration Save — ${spellName}`,
    expression: `1d20${mod}`,
    meta: { dc: check.dc, damage: check.damage },
  };
}
