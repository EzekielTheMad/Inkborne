"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCharacter, useSpells } from "@/lib/character/character-context";
import { SpellHeader } from "@/components/sheet/spells/spell-header";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import { SpellRow } from "@/components/sheet/spells/spell-row";
import { AddSpellPanel } from "@/components/sheet/spells/add-spell-panel";
import { SheetEmptyState } from "@/components/sheet/empty-state";
import { CastDialog } from "@/components/sheet/spells/cast-dialog";
import { getSpellCastability } from "@/lib/spells/casting";
import type { CharacterSpell } from "@/lib/types/spells";

const CASTER_CLASSES = [
  "Bard",
  "Cleric",
  "Druid",
  "Paladin",
  "Ranger",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

function levelLabel(level: number): string {
  if (level === 0) return "Cantrips";
  if (level === 1) return "1st Level";
  if (level === 2) return "2nd Level";
  if (level === 3) return "3rd Level";
  return `${level}th Level`;
}

export function SpellsTab() {
  const { character } = useCharacter();
  const { casterInfo, spells, updateSpell, removeSpell } = useSpells();
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [castTarget, setCastTarget] = useState<{
    spell: CharacterSpell;
    castability: "full" | "ritual-only";
  } | null>(null);

  /** Spells sorted by level (cantrips first, then 1st-9th), then by name. */
  const sortedSpells = useMemo(() => {
    return [...spells].sort((a, b) => {
      const aLevel = (a.content_definitions?.data?.level as number | undefined) ?? 0;
      const bLevel = (b.content_definitions?.data?.level as number | undefined) ?? 0;
      if (aLevel !== bLevel) return aLevel - bLevel;
      return a.name.localeCompare(b.name);
    });
  }, [spells]);

  /** Grouped for level dividers: [{level, spells}] in order. */
  const groupedSpells = useMemo(() => {
    const groups: Array<{ level: number; spells: CharacterSpell[] }> = [];
    let current: { level: number; spells: CharacterSpell[] } | null = null;
    for (const spell of sortedSpells) {
      const level = (spell.content_definitions?.data?.level as number | undefined) ?? 0;
      if (!current || current.level !== level) {
        current = { level, spells: [] };
        groups.push(current);
      }
      current.spells.push(spell);
    }
    return groups;
  }, [sortedSpells]);

  const hasAnySpells = spells.length > 0;
  const anyClassPrepared = casterInfo.classes.some((c) => c.prepared);

  if (!casterInfo.isCaster) {
    return (
      <div className="p-3 space-y-3">
        <p className="text-sm font-medium">Spells</p>
        <SheetEmptyState hint={`Casting classes: ${CASTER_CLASSES.join(", ")}.`}>
          This character cannot cast spells.
        </SheetEmptyState>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Spells</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddPanel((v) => !v)}
        >
          <Plus className="size-3.5 mr-1" />
          {showAddPanel ? "Close" : "Add Spell"}
        </Button>
      </div>

      {showAddPanel && (
        <AddSpellPanel
          open={showAddPanel}
          onClose={() => setShowAddPanel(false)}
          systemId={character.system_id}
        />
      )}

      <SpellHeader />
      <SlotTracker />

      {!hasAnySpells ? (
        <SheetEmptyState
          hint={
            <>
              Click <strong>+ Add Spell</strong> to get started.
            </>
          }
        >
          You haven&apos;t picked any spells yet.
        </SheetEmptyState>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {groupedSpells.map((group) => (
            <div key={group.level}>
              <div className="px-3 py-1.5 bg-muted/40 border-b border-border/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {levelLabel(group.level)}
                <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
                  ({group.spells.length})
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {group.spells.map((spell) => {
                  const castability = getSpellCastability(spell, casterInfo);
                  return (
                    <SpellRow
                      key={spell.id}
                      spell={spell}
                      allowPrepareToggle={anyClassPrepared}
                      castability={castability}
                      onTogglePrepared={() =>
                        updateSpell(spell.id, { is_prepared: !spell.is_prepared })
                      }
                      onRemove={() => removeSpell(spell.id)}
                      onCast={
                        castability !== "none"
                          ? () => setCastTarget({ spell, castability })
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {castTarget && (
        <CastDialog
          key={castTarget.spell.id}
          spell={castTarget.spell}
          castability={castTarget.castability}
          open
          onClose={() => setCastTarget(null)}
        />
      )}
    </div>
  );
}
