"use client";

import { cn } from "@/lib/utils";
import { formatModifier } from "@/lib/sheet/helpers";
import { RollPopover } from "@/components/sheet/rolls/roll-popover";

interface AbilityCardProps {
  ability?: string;
  name: string;
  score: number;
  modifier: number;
  className?: string;
  /**
   * Full ability name ("Strength"). When set, the card becomes a roll
   * trigger: click → Normal/Advantage/Disadvantage popover → ability check
   * (M3 T3). Omit to render the static card (non-sheet contexts).
   */
  rollLabel?: string;
}

export function AbilityCard({
  ability,
  name,
  score,
  modifier,
  className,
  rollLabel,
}: AbilityCardProps) {
  const cardClasses = cn(
    "rounded-lg border border-border bg-card p-3 text-center min-w-[70px]",
    className,
  );

  const body = (
    <>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {name}
      </p>
      <p className="text-2xl font-bold text-foreground leading-tight">
        {Number.isFinite(modifier) ? formatModifier(modifier) : "--"}
      </p>
      <p className="text-sm text-muted-foreground">{Number.isFinite(score) ? score : "Unavailable"}</p>
    </>
  );

  if (!rollLabel) {
    return <div className={cardClasses}>{body}</div>;
  }

  return (
    <RollPopover
      kind="check"
      label={`${rollLabel} Check`}
      modifier={modifier}
      mechanicsRequirement={ability ? { abilities: [ability], values: [score, modifier] } : undefined}
      className={cardClasses}
      ariaLabel={`Roll ${rollLabel} check`}
    >
      {body}
    </RollPopover>
  );
}
