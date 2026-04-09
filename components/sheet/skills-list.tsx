"use client";

import { cn } from "@/lib/utils";
import {
  formatModifier,
  isProficient,
  hasExpertise,
  getSkillModifier,
} from "@/lib/sheet/helpers";
import type { SystemSchemaDefinition, SkillDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";

interface SkillsListProps {
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
}

export function SkillsList({ schema, evalResult }: SkillsListProps) {
  const { grants, stats, computed } = evalResult;
  const proficiencyBonus = computed.proficiency_bonus ?? 0;

  // Sort skills alphabetically
  const sortedSkills: SkillDefinition[] = [...schema.skills].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide mb-2">
        Skills
      </h3>
      <div className="space-y-0.5">
        {sortedSkills.map((skill) => {
          const abilityMod = stats[`${skill.ability}_mod`] ?? 0;
          const proficient = isProficient(grants, skill.slug);
          const expertise = hasExpertise(grants, skill.slug);
          const modifier = getSkillModifier(
            abilityMod,
            proficiencyBonus,
            grants,
            skill.slug,
          );

          // Find the ability abbreviation from schema
          const abilityDef = schema.ability_scores.find(
            (a) => a.slug === skill.ability,
          );
          const abilityAbbr = abilityDef?.abbr ?? skill.ability.slice(0, 3).toUpperCase();

          return (
            <div
              key={skill.slug}
              className={cn(
                "flex items-center gap-2 py-1 px-2 rounded-sm",
                (proficient || expertise) && "bg-primary/5",
              )}
            >
              {/* Proficiency indicator */}
              <span
                className={cn(
                  "text-xs leading-none select-none w-3 shrink-0",
                  expertise
                    ? "text-accent"
                    : proficient
                      ? "text-accent"
                      : "text-muted-foreground",
                )}
                aria-label={
                  expertise ? "Expertise" : proficient ? "Proficient" : "Not proficient"
                }
              >
                {expertise ? "◐" : proficient ? "●" : "○"}
              </span>

              {/* Ability abbreviation */}
              <span className="text-xs text-muted-foreground w-8 shrink-0 tabular-nums">
                {abilityAbbr}
              </span>

              {/* Skill name */}
              <span
                className={cn(
                  "text-sm flex-1",
                  proficient || expertise ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {skill.name}
              </span>

              {/* Modifier */}
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  proficient || expertise ? "text-accent" : "text-muted-foreground",
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
