"use client";

import { cn } from "@/lib/utils";
import { formatModifier, resolveSavingThrowModifier } from "@/lib/sheet/helpers";
import { RollPopover } from "@/components/sheet/rolls/roll-popover";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";
import { getConfirmedAbilityModifier } from "@/lib/character/ability-mechanics";
import { useCharacter } from "@/lib/character/character-context";

interface SavingThrowsProps {
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
}

export function SavingThrows({ schema, evalResult }: SavingThrowsProps) {
  const { savingThrowBonus } = useCharacter();
  const { grants, computed } = evalResult;
  const proficiencyBonus = computed.proficiency_bonus;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Saving Throws
      </h3>
      {savingThrowBonus?.status !== "available" && <p role="status" className="text-xs text-muted-foreground">
        {savingThrowBonus?.reason ?? "Saving throw inputs are incomplete. Reload before rolling."}
      </p>}
      <div className="grid grid-cols-2 gap-1.5">
        {schema.ability_scores.map((ability) => {
          const saveSlug = `saving_throw_${ability.slug}`;
          const savingThrow = resolveSavingThrowModifier(getConfirmedAbilityModifier(evalResult, schema, ability.slug),
            proficiencyBonus, grants, saveSlug, savingThrowBonus);
          const proficient = savingThrow.status === "available" && savingThrow.proficient;
          const modifier = savingThrow.status === "available" ? savingThrow.modifier : Number.NaN;

          return (
            <RollPopover
              key={ability.slug}
              kind="save"
              label={`${ability.name} Save`}
              modifier={modifier}
              mechanicsRequirement={{ abilities: [ability.slug], computed: ["proficiency_bonus"], values: [modifier], savingThrows: [ability.slug] }}
              disabled={savingThrow.status !== "available"}
              ariaLabel={`Roll ${ability.name} saving throw`}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-left",
                proficient
                  ? "border-character-border bg-character-bg"
                  : "border-border bg-card",
              )}
            >
              {/* Proficiency dot */}
              <span
                className={cn(
                  "text-xs leading-none select-none",
                  proficient ? "text-character-fg" : "text-muted-foreground",
                )}
                aria-label={savingThrow.status !== "available" ? "Saving throw unavailable" : proficient ? "Proficient" : "Not proficient"}
              >
                {savingThrow.status !== "available" ? "—" : proficient ? "●" : "○"}
              </span>

              {/* Ability abbreviation */}
              <span
                className={cn(
                  "text-xs font-medium uppercase flex-1",
                  proficient ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {ability.abbr}
              </span>

              {/* Modifier */}
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  proficient ? "text-character-fg" : "text-muted-foreground",
                )}
              >
                {savingThrow.status === "available" ? formatModifier(modifier) : "Unavailable"}
              </span>
              {savingThrow.status !== "available" && savingThrowBonus?.status === "available"
                && <span className="text-xs text-muted-foreground">{savingThrow.reason}</span>}
            </RollPopover>
          );
        })}
      </div>
    </div>
  );
}
