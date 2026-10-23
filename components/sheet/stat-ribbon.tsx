import { Separator } from "@/components/ui/separator";
import { AbilityCard } from "@/components/sheet/ability-card";
import { CombatStats } from "@/components/sheet/combat-stats";
import { HPTracker, type HPConcentrationProps } from "@/components/sheet/hp-tracker";
import { DeathSaves } from "@/components/sheet/death-saves";
import { RestButton } from "@/components/sheet/rest-button";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { CharacterState } from "@/lib/types/character";
import type { HitDicePool } from "@/lib/hit-dice/helpers";
import styles from "@/components/character/character-notebook.module.css";

interface StatRibbonProps {
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
  state: CharacterState;
  maxHp: number;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;
  /** Read-only hit-dice pools threaded into the HP tracker popover. */
  hitDicePools?: HitDicePool[];
  /** Concentration wiring threaded into the HP tracker damage path (T7). */
  concentration?: HPConcentrationProps;
}

export function StatRibbon({
  schema,
  evalResult,
  state,
  maxHp,
  patchState,
  hitDicePools,
  concentration,
}: StatRibbonProps) {
  const { stats, computed } = evalResult;

  const proficiencyBonus = computed.proficiency_bonus ?? 2;
  const armorClass = computed.armor_class ?? computed.ac ?? 10;
  const initiative = computed.initiative ?? Math.floor(((stats.dexterity ?? 10) - 10) / 2);
  const speed = computed.speed ?? computed.movement_speed ?? 30;

  return (
    <div className={styles.statRibbon}>
      {/* Ability score cards: 3x2 grid on mobile, horizontal row on desktop */}
      <div className={styles.abilities}>
        {schema.ability_scores.map((ability) => {
          const score = stats[ability.slug] ?? 10;
          const modifier = Math.floor((score - 10) / 2);
          return (
            <AbilityCard
              key={ability.slug}
              name={ability.abbr}
              score={score}
              modifier={modifier}
              rollLabel={ability.name}
            />
          );
        })}
      </div>

      <Separator orientation="vertical" className="hidden md:block h-16" />

      {/* Combat stats */}
      <div>
        <CombatStats
          proficiencyBonus={proficiencyBonus}
          armorClass={armorClass}
          initiative={initiative}
          speed={speed}
          speedDetail={evalResult.speed}
          rollable
        />
      </div>

      <Separator orientation="vertical" className="hidden md:block h-16" />

      {/* HP Tracker */}
      <div className={styles.vital}>
        <HPTracker
          currentHp={state.current_hp ?? maxHp}
          maxHp={maxHp}
          tempHp={state.temp_hp ?? 0}
          patchState={patchState}
          hitDicePools={hitDicePools}
          concentration={concentration}
        />
      </div>

      {/* Death saves — DeathSaves returns null when currentHp > 0, so this
          slot takes no space during normal play. */}
      <div className="shrink-0">
        <DeathSaves
          currentHp={state.current_hp ?? maxHp}
          deathSaves={state.death_saves ?? { successes: 0, failures: 0 }}
          patchState={patchState}
        />
      </div>

      <Separator orientation="vertical" className="hidden md:block h-16" />

      {/* Rest Button */}
      <div className="shrink-0">
        <RestButton />
      </div>
    </div>
  );
}
