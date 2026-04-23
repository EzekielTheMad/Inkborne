"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCharacter, useSpells } from "@/lib/character/character-context";
import { SpellHeader } from "@/components/sheet/spells/spell-header";
import { SlotTracker } from "@/components/sheet/spells/slot-tracker";
import { SpellLevelSection } from "@/components/sheet/spells/spell-level-section";
import { AddSpellPanel } from "@/components/sheet/spells/add-spell-panel";
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

export function SpellsTab() {
  const { character } = useCharacter();
  const { casterInfo, spells, slotState, maxSlots, updateSpell, removeSpell } = useSpells();
  const [showAddPanel, setShowAddPanel] = useState(false);

  const spellsByLevel = useMemo(() => {
    const groups: Record<number, CharacterSpell[]> = {};
    for (const s of spells) {
      const level = (s.content_definitions?.data?.level as number | undefined) ?? 0;
      if (!groups[level]) groups[level] = [];
      groups[level].push(s);
    }
    return groups;
  }, [spells]);

  const hasAnySpells = spells.length > 0;
  const anyClassPrepared = casterInfo.classes.some((c) => c.prepared);

  if (!casterInfo.isCaster) {
    return (
      <div className="p-3 space-y-3">
        <p className="text-sm font-medium">Spells</p>
        <div className="rounded-lg border border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
          <p>This character cannot cast spells.</p>
          <p className="text-xs mt-1">
            Casting classes: {CASTER_CLASSES.join(", ")}.
          </p>
        </div>
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
        <div className="rounded-lg border border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
          <p>You haven't picked any spells yet.</p>
          <p className="text-xs mt-1">
            Click <strong>+ Add Spell</strong> to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, level) => {
            const spellsAtLevel = spellsByLevel[level] ?? [];
            if (spellsAtLevel.length === 0 && level > 0) return null;
            const total = level === 0 ? undefined : maxSlots[String(level) as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"];
            const used = level === 0 ? undefined : slotState[String(level) as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"];
            return (
              <SpellLevelSection
                key={level}
                level={level}
                spells={spellsAtLevel}
                maxSlots={total}
                usedSlots={used}
                defaultOpen={level === 0}
                allowPrepareToggle={anyClassPrepared}
                onTogglePrepared={(spell) =>
                  updateSpell(spell.id, { is_prepared: !spell.is_prepared })
                }
                onRemove={(spell) => removeSpell(spell.id)}
              />
            );
          })}
          {(maxSlots.pact ?? 0) > 0 && (
            <SpellLevelSection
              level={0}
              isPactSection
              spells={[]}
              maxSlots={maxSlots.pact}
              usedSlots={slotState.pact}
              defaultOpen={false}
              allowPrepareToggle={false}
              onTogglePrepared={() => {}}
              onRemove={() => {}}
            />
          )}
        </div>
      )}
    </div>
  );
}
