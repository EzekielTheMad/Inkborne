"use client";

import { getSkillModifier } from "@/lib/sheet/helpers";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { EvaluationResult } from "@/lib/engine/evaluator";

interface PassiveSensesProps {
  schema: SystemSchemaDefinition;
  evalResult: EvaluationResult;
}

interface SenseCard {
  label: string;
  abbr: string;
  value: number;
}

export function PassiveSenses({ schema, evalResult }: PassiveSensesProps) {
  const { grants, stats, computed, narratives, vision } = evalResult;
  const proficiencyBonus = computed.proficiency_bonus ?? 0;

  // Helper: get the ability mod for a given ability slug
  function getAbilityMod(abilitySlug: string): number {
    return stats[`${abilitySlug}_mod`] ?? 0;
  }

  // Helper: find the ability slug for a given skill slug from schema
  function getSkillAbility(skillSlug: string): string {
    return schema.skills.find((s) => s.slug === skillSlug)?.ability ?? "";
  }

  // Compute passive value: 10 + skill modifier
  function passiveValue(skillSlug: string): number {
    const abilitySlug = getSkillAbility(skillSlug);
    const abilityMod = getAbilityMod(abilitySlug);
    const skillMod = getSkillModifier(abilityMod, proficiencyBonus, grants, skillSlug);
    return 10 + skillMod;
  }

  const senses: SenseCard[] = [
    { label: "Perception", abbr: "PER", value: passiveValue("perception") },
    { label: "Investigation", abbr: "INV", value: passiveValue("investigation") },
    { label: "Insight", abbr: "INS", value: passiveValue("insight") },
  ];

  // Collect special senses from narratives tagged "sense"
  const specialSenses = narratives
    .filter((n) => n.tag === "sense" || n.tag === "senses")
    .map((n) => n.text);

  // Build vision display from structured vision data
  const visionLabels = vision.map(
    (v) => `${v.type.charAt(0).toUpperCase() + v.type.slice(1)} ${v.range} ft.`,
  );

  // Combine narrative senses and structured vision (deduped)
  const allSpecialSenses = [...new Set([...visionLabels, ...specialSenses])];

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Senses
      </h3>

      <div className="grid grid-cols-3 gap-2">
        {senses.map((sense) => (
          <div
            key={sense.abbr}
            className="flex flex-col items-center rounded-md border border-border bg-background py-2 px-1"
          >
            <span className="text-xl font-bold text-foreground tabular-nums leading-none">
              {sense.value}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground mt-1 tracking-wide">
              {sense.abbr}
            </span>
          </div>
        ))}
      </div>

      {allSpecialSenses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allSpecialSenses.map((sense) => (
            <span
              key={sense}
              className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
            >
              {sense}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
