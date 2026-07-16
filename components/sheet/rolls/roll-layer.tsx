"use client";

import { RollLogPanel } from "@/components/sheet/rolls/roll-log-panel";
import { RollToaster } from "@/components/sheet/rolls/roll-toaster";

/**
 * The single mount point for the roll UX shell (M3 T2): the d20 roll-log
 * trigger + panel, and the transient roll-toast stack (fixed-position, so it
 * renders correctly from anywhere in the tree).
 *
 * Mounted once in `CharacterShell` next to the concentration badge. Later M3
 * tasks (T3+ roll surfaces) only call `useRolls().roll()` — they never need
 * their own toast/log wiring, keeping the integration surface on existing
 * sheet files minimal.
 */
export function RollLayer() {
  return (
    <>
      <RollLogPanel />
      <RollToaster />
    </>
  );
}
