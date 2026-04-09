import { Separator } from "@/components/ui/separator";
import { AbilityCard } from "@/components/sheet/ability-card";
import { CombatStats } from "@/components/sheet/combat-stats";
import { HPTracker } from "@/components/sheet/hp-tracker";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { CharacterState } from "@/lib/types/character";

interface StatRibbonProps {
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  state: CharacterState;
  maxHp: number;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
}

export function StatRibbon({
  schema,
  evalResult,
  state,
  maxHp,
  patchState,
}: StatRibbonProps) {
  const { stats, computed } = evalResult;

  const proficiencyBonus = computed.proficiency_bonus ?? 2;
  const armorClass = computed.armor_class ?? computed.ac ?? 10;
  const initiative = computed.initiative ?? Math.floor(((stats.dexterity ?? 10) - 10) / 2);
  const speed = computed.speed ?? computed.movement_speed ?? 30;

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1">
      {/* Ability score cards: 3x2 grid on mobile, horizontal row on desktop */}
      <div className="grid grid-cols-3 gap-2 md:flex md:gap-2 shrink-0">
        {schema.ability_scores.map((ability) => {
          const score = stats[ability.slug] ?? 10;
          const modifier = Math.floor((score - 10) / 2);
          return (
            <AbilityCard
              key={ability.slug}
              name={ability.abbr}
              score={score}
              modifier={modifier}
            />
          );
        })}
      </div>

      <Separator orientation="vertical" className="hidden md:block h-16" />

      {/* Combat stats */}
      <div className="shrink-0">
        <CombatStats
          proficiencyBonus={proficiencyBonus}
          armorClass={armorClass}
          initiative={initiative}
          speed={speed}
        />
      </div>

      <Separator orientation="vertical" className="hidden md:block h-16" />

      {/* HP Tracker */}
      <div className="shrink-0">
        <HPTracker
          currentHp={state.current_hp ?? maxHp}
          maxHp={maxHp}
          tempHp={state.temp_hp ?? 0}
          patchState={patchState}
        />
      </div>
    </div>
  );
}
