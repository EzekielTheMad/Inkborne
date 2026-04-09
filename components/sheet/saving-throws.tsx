"use client";

import { cn } from "@/lib/utils";
import { formatModifier, isProficient, getSaveModifier } from "@/lib/sheet/helpers";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";

interface SavingThrowsProps {
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
}

export function SavingThrows({ schema, evalResult }: SavingThrowsProps) {
  const { grants, stats, computed } = evalResult;
  const proficiencyBonus = computed.proficiency_bonus ?? 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Saving Throws
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {schema.ability_scores.map((ability) => {
          const saveSlug = `saving_throw_${ability.slug}`;
          const abilityMod = stats[`${ability.slug}_mod`] ?? 0;
          const proficient = isProficient(grants, saveSlug);
          const modifier = getSaveModifier(abilityMod, proficiencyBonus, grants, saveSlug);

          return (
            <div
              key={ability.slug}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1",
                proficient
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              {/* Proficiency dot */}
              <span
                className={cn(
                  "text-xs leading-none select-none",
                  proficient ? "text-primary" : "text-muted-foreground",
                )}
                aria-label={proficient ? "Proficient" : "Not proficient"}
              >
                {proficient ? "●" : "○"}
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
                  proficient ? "text-accent" : "text-muted-foreground",
                )}
              >
                {formatModifier(modifier)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
