"use client";

import { useSpells } from "@/lib/character/character-context";

export function SpellHeader() {
  const { casterInfo, spells } = useSpells();
  if (!casterInfo.isCaster) return null;

  const cantripsKnown = spells.filter(
    (s) => (s.content_definitions?.data?.level ?? 1) === 0,
  ).length;
  const preparedCount = spells.filter((s) => s.is_prepared).length;
  const totalCantripsAllowed = casterInfo.classes.reduce(
    (sum, c) => sum + c.cantripsKnown,
    0,
  );
  const totalPrepared = casterInfo.classes.reduce(
    (sum, c) => sum + (c.prepared ? c.maxPrepared : 0),
    0,
  );

  const abilityLabel = casterInfo.classes
    .map((c) => c.ability.charAt(0).toUpperCase() + c.ability.slice(1))
    .join(", ");

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-1">
      <p className="text-xs text-muted-foreground">Spellcasting Ability</p>
      <p className="text-sm font-medium">{abilityLabel}</p>
      <div className="flex items-center gap-4 text-sm pt-1">
        <span>
          Save DC <span className="font-semibold">{casterInfo.spellDc}</span>
        </span>
        <span>
          Attack{" "}
          <span className="font-semibold">
            {casterInfo.spellAttackBonus >= 0 ? "+" : ""}
            {casterInfo.spellAttackBonus}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span>
          Cantrips: {cantripsKnown}/{totalCantripsAllowed}
        </span>
        {totalPrepared > 0 && (
          <span>
            Prepared: {preparedCount}/{totalPrepared}
          </span>
        )}
      </div>
    </div>
  );
}
