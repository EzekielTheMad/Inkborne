import type { EvaluationResult } from "@/lib/engine/evaluator";

interface DefensesProps {
  evalResult: EvaluationResult;
}

export function Defenses({ evalResult }: DefensesProps) {
  const { dmgres, savetxt } = evalResult;

  const hasResistances = dmgres.length > 0;
  const hasAdvantages = savetxt.adv_vs.length > 0;
  const hasImmunities = savetxt.immune.length > 0;
  const hasContent = hasResistances || hasAdvantages || hasImmunities;

  if (!hasContent) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Defenses
      </h3>

      {hasResistances && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Resistances
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dmgres.map((res) => (
              <span
                key={res}
                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize"
              >
                {res}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasAdvantages && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Save Advantages
          </p>
          <div className="flex flex-wrap gap-1.5">
            {savetxt.adv_vs.map((adv) => (
              <span
                key={adv}
                className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
              >
                vs. {adv}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasImmunities && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Condition Immunities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {savetxt.immune.map((imm) => (
              <span
                key={imm}
                className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full capitalize"
              >
                {imm}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
