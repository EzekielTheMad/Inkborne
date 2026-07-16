"use client";

import { cn } from "@/lib/utils";
import { formatModifier } from "@/lib/sheet/helpers";
import { RollPopover } from "@/components/sheet/rolls/roll-popover";
import type { SpeedData } from "@/lib/schemas/content-types/mechanical";

interface CombatStatCardProps {
  label: string;
  value: string | number;
  accent?: boolean;
  ring?: boolean;
}

function combatStatCardClasses(ring?: boolean): string {
  return cn(
    "rounded-lg border bg-card p-2.5 text-center min-w-[60px]",
    ring ? "border-primary" : "border-border",
  );
}

function CombatStatCardBody({ label, value, accent }: Omit<CombatStatCardProps, "ring">) {
  return (
    <>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-bold leading-tight",
          accent ? "text-accent" : "text-foreground",
        )}
      >
        {value}
      </p>
    </>
  );
}

function CombatStatCard({ label, value, accent, ring }: CombatStatCardProps) {
  return (
    <div className={combatStatCardClasses(ring)}>
      <CombatStatCardBody label={label} value={value} accent={accent} />
    </div>
  );
}

const SPEED_LABELS: Record<string, string> = {
  walk: "Walk",
  fly: "Fly",
  swim: "Swim",
  climb: "Climb",
  burrow: "Burrow",
};

interface CombatStatsProps {
  proficiencyBonus: number;
  armorClass: number;
  initiative: number;
  speed: number;
  speedDetail?: SpeedData;
  /** When true (sheet contexts), the INIT card becomes a roll trigger (M3 T3). */
  rollable?: boolean;
}

export function CombatStats({
  proficiencyBonus,
  armorClass,
  initiative,
  speed,
  speedDetail,
  rollable,
}: CombatStatsProps) {
  // Build the speed display: use speedDetail if available, fall back to single speed number
  const extraSpeeds = speedDetail
    ? (Object.entries(speedDetail) as [string, number | undefined][])
        .filter(([key, val]) => key !== "walk" && key !== "encumbered" && val != null && val > 0)
        .map(([key, val]) => ({ label: SPEED_LABELS[key] ?? key, value: val! }))
    : [];

  const walkSpeed = speedDetail?.walk ?? speed;

  return (
    <div className="flex items-center gap-2">
      <CombatStatCard
        label="PROF"
        value={formatModifier(proficiencyBonus)}
        accent
      />
      <CombatStatCard label="AC" value={armorClass} accent ring />
      {rollable ? (
        <RollPopover
          kind="initiative"
          label="Initiative"
          modifier={initiative}
          className={combatStatCardClasses()}
          ariaLabel="Roll initiative"
        >
          <CombatStatCardBody label="INIT" value={formatModifier(initiative)} />
        </RollPopover>
      ) : (
        <CombatStatCard label="INIT" value={formatModifier(initiative)} />
      )}
      <div className="flex flex-col items-center gap-0.5">
        <CombatStatCard label="SPEED" value={`${walkSpeed}ft`} />
        {extraSpeeds.length > 0 && (
          <div className="flex gap-1.5">
            {extraSpeeds.map(({ label, value }) => (
              <span
                key={label}
                className="text-[10px] text-muted-foreground"
              >
                {label} {value}ft
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
