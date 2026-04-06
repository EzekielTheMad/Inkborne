import type { Effect, MechanicalEffect } from "@/lib/types/effects";
import { EFFECT_OP_PRIORITY } from "@/lib/types/effects";

export function collectEffects(contentEffects: Effect[][]): Effect[] {
  return contentEffects.flat();
}

export function sortEffectsByPriority(
  effects: MechanicalEffect[]
): MechanicalEffect[] {
  return [...effects].sort((a, b) => {
    const aPriority = EFFECT_OP_PRIORITY[a.op] ?? 99;
    const bPriority = EFFECT_OP_PRIORITY[b.op] ?? 99;
    return aPriority - bPriority;
  });
}

export function groupEffectsByStat(
  effects: MechanicalEffect[]
): Map<string, MechanicalEffect[]> {
  const grouped = new Map<string, MechanicalEffect[]>();
  for (const effect of effects) {
    const existing = grouped.get(effect.stat) ?? [];
    existing.push(effect);
    grouped.set(effect.stat, existing);
  }
  return grouped;
}
